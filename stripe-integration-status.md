# Estado de la integración con Stripe — informe de revisión

> Fecha: 2026-09-19 · Rama: `main` (último commit `371aa7c added checkout creator`)
>
> Este informe sale de leer el código actual, **no** del `stripe-integration-plan.md`.
> No se leyó el `.env` (se asume que las claves y variables están bien puestas) y no se
> llamó a Stripe ni se levantó el server: todo lo que dice "verificado" fue con
> `nest build` y `vitest`; el resto es lectura de código.

## 1. Resumen

**Hoy la integración no se puede probar de punta a punta.** El proyecto ni siquiera compila
(`nest build` termina con exit 1), y aunque compilara, faltan el webhook y la carga del `.env`.
Lo que hay es la mitad del "crear checkout": se arma la sesión de Stripe pero el resultado
se tira a la basura y la venta se guarda con datos que manda el cliente.

| Pieza | Estado |
|---|---|
| Compila (`nest build`) | ❌ 2 errores TS (verificado) |
| Carga de `.env` | ❌ nada lo carga |
| Crear Checkout Session | ⚠️ existe pero mal cableada (no se `await`, no se devuelve la URL, monto en unidades equivocadas) |
| Guardar la venta (`sale`) | ⚠️ se guarda con lo que manda el cliente; el repositorio lee mal las columnas |
| Webhook (`checkout.session.completed`) | ❌ no existe (ni `rawBody`, ni verificación de firma) |
| Marcar Pokémon vendido tras el pago | ❌ hoy lo hace `POST /pokemon/:id/buy` **sin cobrar** |
| Frontend | ❌ sigue llamando a `/pokemon/:id/buy`; no hay páginas `/success` ni `/cancel` |
| Tests | ❌ 3 de 5 fallan (verificado) |

## 2. Lo que sí está bien

- `stripe@22.6.2` instalado y `apiVersion: '2026-08-26.dahlia'` coincide con la versión que
  trae el SDK ([sale.service.ts:21-23](src/sale/sale.service.ts#L21-L23)).
- `metadata: { pokemonId }` ya se manda al crear la sesión
  ([sale.service.ts:65](src/sale/sale.service.ts#L65)); es lo que el webhook va a necesitar.
- `SaleModule` importa `PokemonModule` y éste exporta `PokemonService`
  ([sale.module.ts:10](src/sale/sale.module.ts#L10), [pokemon.module.ts:9](src/pokemon/pokemon.module.ts#L9)).
- La tabla `sale` se crea en [db.ts:15-26](src/storage/db.ts#L15-L26) y el repositorio usa
  consultas parametrizadas (sin riesgo de SQL injection).
- `.env` está en `.gitignore`, así que las claves no se suben.

## 3. Dónde rompe hoy

Ordenado de más a menos grave. Los primeros 5 son bloqueantes para probar Stripe.

### 🔴 Bloqueantes

**B1. El proyecto no compila.**
[sale.controller.ts:27](src/sale/sale.controller.ts#L27) y [sale.controller.ts:32](src/sale/sale.controller.ts#L32)
llaman a `saleService.update` y `saleService.remove`, que no existen (quedaron del boilerplate
de `nest g resource`). `nest build` → `TS2339` ×2, exit 1. `nest start` no arranca limpio.
*Fix:* borrar esos dos endpoints (`PATCH` y `DELETE`); una venta no debería editarse ni
borrarse desde afuera.

**B2. Nadie carga el `.env`.**
`ConfigModule` no está en [app.module.ts](src/app.module.ts), `package.json` no usa
`--env-file`, y el Nest CLI no lee `.env`. `@nestjs/config` está instalado pero sin usar.
Resultado: `process.env.STRIPE_SECRET_KEY`, `FRONTEND_URL` y `PORT` llegan `undefined`.

Ojo con el orden: [sale.service.ts:9-11](src/sale/sale.service.ts#L9-L11) lee
`process.env` **a nivel de módulo**, o sea al importar el archivo, antes de que
`ConfigModule.forRoot()` corra. Agregar sólo `ConfigModule` **no alcanza**: esas constantes
seguirían en `undefined`.
*Fix:* registrar `ConfigModule.forRoot({ isGlobal: true })` **y** leer las variables con
`ConfigService` dentro del constructor de `SaleService` (o arrancar con
`node --env-file=.env`).

**B3. `SaleService.create` no devuelve la URL de pago y deja una promesa colgando.**
[sale.service.ts:44](src/sale/sale.service.ts#L44): `this.createCheckoutSession(...)` no lleva
`await`, así que `checkout` es una `Promise` que nunca se usa. Consecuencias:
- El comprador nunca recibe `session.url`, no hay a dónde redirigirlo.
- Si Stripe falla (sin key, URL inválida, monto inválido) el rechazo queda sin manejar y
  **Node, por defecto, tira el proceso** (`unhandledRejection`). Un error de Stripe puede
  voltear el server.

*Fix:* `await` de la sesión, devolver `{ url: session.url }`.

**B4. El monto está en unidades equivocadas.**
[sale.service.ts:37](src/sale/sale.service.ts#L37) pasa `unit_amount: pokemon.price`, y Stripe
espera **centavos**. Los precios (100, 150, 220, 50) se muestran como dólares en el frontend
([app.js:41](frontend/app.js#L41)), así que Pikachu se cobraría **US$1,00** en vez de US$100.
Además Stripe exige un mínimo de US$0,50 y un entero: `price: 10` o `price: 12.5` (el
formulario lo permite) hacen fallar la creación de la sesión.
*Fix:* `Math.round(pokemon.price * 100)`, y validar precio ≥ 0.50.

**B5. No existe el webhook.**
No hay `@Post('webhook')`, [main.ts:6](src/main.ts#L6) no activa `rawBody: true`, y no se usa
`STRIPE_WEBHOOK_SECRET` ni `stripe.webhooks.constructEvent`. Nada confirma un pago, así que
ni el Pokémon ni la venta pasan nunca a "pagado". Este es el corazón de lo que hay que probar.
Además el repositorio sólo tiene `markAsCompleted(id)` por **id de venta**; el webhook recibe
el **id de sesión de Stripe**, y hay que ir a buscar la venta con `findByStripeSessionId`.

### 🟠 Bugs que van a aparecer al probar

**M1. `rowToSale` lee columnas que no existen con ese nombre.**
SQLite devuelve las columnas como se declararon en el `CREATE TABLE`: `productid` y
`stripedata` (minúsculas, [db.ts:20,23](src/storage/db.ts#L20)). El repositorio lee
`row.productId` y `row.stripeData` ([sale.repository.ts:22,24](src/sale/sale.repository.ts#L22)),
que son `undefined`. Toda `Sale` que sale del repositorio tiene `productId` y `stripeData`
vacíos.

**M2. El status de una venta siempre se lee como `PENDING`.**
El constructor de `Sale` ignora el status recibido y fija `PENDING`
([sale.entity.ts:21](src/sale/entities/sale.entity.ts#L21)); `rowToSale` no llama a
`setStatus`. Aunque el webhook marque la fila como `COMPLETED`, `GET /sale` va a seguir
mostrando `PENDING`, lo que puede hacerte creer que el webhook falló.

**M3. La venta se guarda con datos que manda el cliente.**
`POST /sale` recibe todo el `CreateSaleDto` ([create-sale.dto.ts](src/sale/dto/create-sale.dto.ts)) y
lo inserta tal cual ([sale.service.ts:45](src/sale/sale.service.ts#L45)):
- El cliente decide `price`, `status` (puede mandar `COMPLETED`), `date` y `stripeData`.
- `stripeData` debería ser el `session.id` de Stripe (es lo que busca
  `findByStripeSessionId`), pero nunca se rellena con eso.
- No hay validación (no hay `ValidationPipe` ni `class-validator`). Si falta cualquier campo,
  `undefined` no se puede enlazar en `node:sqlite` y el request termina en 500.

*Fix:* que el DTO de entrada sea sólo `{ productId, client, address }` y que el servidor
complete `price` (desde el Pokémon), `status = PENDING`, y `stripeData = session.id`.

**M4. URLs de retorno mal armadas y a páginas que no existen.**
[sale.service.ts:63-64](src/sale/sale.service.ts#L63-L64) arma `${frontendUrl}:${port}/success`.
Si `FRONTEND_URL` ya trae el puerto (el plan sugería `http://localhost:3000`) queda
`http://localhost:3000:3000/success`, que Stripe rechaza; si `PORT` no está cargado
(ver B2) queda `:undefined`. Y aunque la URL fuera válida, **no existe ninguna ruta
`/success` ni `/cancel`**: el frontend se sirve bajo `/app`
([app.module.ts:11-14](src/app.module.ts#L11-L14)). Después de pagar, el usuario vería un 404.
*Fix:* una sola variable con la URL base completa y apuntar a `/app/?checkout=success|cancel`.

**M5. `POST /pokemon/:id/buy` marca vendido sin cobrar, y es lo que usa el frontend.**
[pokemon.service.ts:46](src/pokemon/pokemon.service.ts#L46) tiene `// apply charge here;` y
marca vendido igual. [app.js:137-146](frontend/app.js#L137-L146) llama a ese endpoint, así que
el botón "Comprar" nunca toca Stripe, y como el endpoint es público, cualquiera puede marcar
todo como vendido. Para probar Stripe hay que redirigir el botón a `POST /sale`, y a futuro
sacar o proteger `/buy`.

### 🟡 Menores / deuda

- **Esquema:** `address INTEGER` en [db.ts:19](src/storage/db.ts#L19) debería ser `TEXT`
  (hoy funciona porque SQLite es permisivo con los tipos). No hay FK de `productid` a
  `pokemon`, ni índice único sobre la sesión de Stripe.
- **Carrera:** dos compradores pueden abrir checkout del mismo Pokémon a la vez y pagar los
  dos; el segundo `checkout.session.completed` llegaría con el Pokémon ya vendido.
  Para la primera prueba alcanza con saberlo.
- **Reutilizar `buyPokemon` desde el webhook** lanza `ConflictException` si ya estaba vendido
  ([pokemon.service.ts:44](src/pokemon/pokemon.service.ts#L44)). Un 409 hace que Stripe
  reintente el webhook una y otra vez; hay que atraparlo y responder 2xx.
- **Códigos HTTP inconsistentes:** `SaleService` usa `NotAcceptableException` (406) donde
  `PokemonService` usa `ConflictException` (409) para "ya vendido".
- **Puerto:** `main.ts` cae a `5173` si no hay `PORT`; `pixi.http` y
  [app.service.ts:6](src/app.service.ts#L6) asumen `3000`. El `stripe listen --forward-to`
  tiene que apuntar al puerto real.
- **Base de datos relativa al cwd:** `new DatabaseSync('pokemon.db')`
  ([db.ts:3](src/storage/db.ts#L3)) crea/lee el archivo desde donde se lance el proceso.
- **`PATCH /pokemon/:id`** permite cambiar el precio sin validar (0, negativo, decimales).
- Imports sin usar (`Inject`, `CreateSaleDto` en el servicio, `Pokemon`, `UpdateSaleDto`).

## 4. Estado de los tests (verificado)

`nest build` → **exit 1** (B1). `vitest run` → **3 de 5 fallan**:

| Spec | Falla por |
|---|---|
| [app.controller.spec.ts](src/app.controller.spec.ts) | espera `'Hello World!'` pero `AppService` devuelve un HTML con un link ([app.service.ts:6](src/app.service.ts#L6)) |
| [sale.service.spec.ts](src/sale/sale.service.spec.ts) | DI: `SaleService` necesita `SaleRepository` y `PokemonService`, el spec sólo registra `SaleService` |
| [sale.controller.spec.ts](src/sale/sale.controller.spec.ts) | mismo problema de DI |

Y un tercer problema de fondo: todos los specs importan `db.ts`, que abre el archivo real
`pokemon.db`. Con los archivos corriendo en paralelo, `vitest` da `database is locked`
(en serie, con `--no-file-parallelism`, no). Es decir, **los tests comparten la base de
desarrollo**. El e2e ([test/app.e2e-spec.ts](test/app.e2e-spec.ts)) además no tipa
(`supertest/types` no se resuelve) y espera el mismo `'Hello World!'` viejo.

Para probar Stripe no hace falta arreglar los tests, pero conviene saber que **no hay red de
seguridad**: hoy los tests no detectarían nada del flujo de pago.

## 5. Qué falta para poder testear que Stripe funciona

Sólo lo mínimo para ver el flujo completo (checkout → pago → webhook → DB). Está en el orden
en que conviene hacerlo.

### Código

- [ ] **Compilar:** eliminar `update`/`remove` de `SaleController` (B1).
- [ ] **Cargar el `.env`:** `ConfigModule.forRoot({ isGlobal: true })` en `AppModule` e
      inyectar `ConfigService` en `SaleService` en vez de leer `process.env` a nivel de
      módulo (B2). Variables que se usan: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
      `PORT`, y la URL base del frontend.
- [ ] **Arreglar `SaleService.create`:** `await` de la sesión; monto en centavos
      (`Math.round(price * 100)`); `price` tomado del Pokémon, no del body; guardar la venta
      con `status = PENDING` y `stripeData = session.id`; devolver `{ url: session.url }`
      (B3, B4, M3).
- [ ] **URLs de retorno válidas** y una forma de ver el resultado en `/app` (M4).
- [ ] **Leer bien las filas:** usar `row.productid` / `row.stripedata` y respetar
      `row.status` en `rowToSale` (M1, M2). Sin esto no vas a poder confirmar en `GET /sale`
      que el webhook funcionó.
- [ ] **Webhook:**
  - `NestFactory.create(AppModule, { rawBody: true })` en `main.ts`.
  - `@Post('sale/webhook')` que reciba `RawBodyRequest` y el header `stripe-signature`.
  - `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`.
  - En `checkout.session.completed`: buscar la venta con `findByStripeSessionId(session.id)`,
    marcarla `COMPLETED` y marcar el Pokémon (`session.metadata.pokemonId`) como vendido.
  - Tolerar que el Pokémon ya esté vendido (no lanzar 409) y responder siempre `{ received: true }`.
- [ ] **Frontend:** que "Comprar" haga `POST /sale` y redirija a `url`
      ([app.js:137](frontend/app.js#L137)); mostrar el resultado de `?checkout=success|cancel`.

### Entorno (una sola vez)

- [ ] Instalar la [Stripe CLI](https://stripe.com/docs/stripe-cli) y hacer `stripe login`
      (cuenta en **modo test**).
- [ ] `stripe listen --forward-to localhost:<PORT>/sale/webhook` y copiar el `whsec_...` que
      imprime a `STRIPE_WEBHOOK_SECRET`. Ese secreto es el de la CLI, no el del Dashboard;
      hay que reiniciar el server después de cambiarlo.
- [ ] Confirmar que `PORT` coincide con el puerto en el que realmente levanta el server.

## 6. Cómo probarlo cuando esté listo

1. `pnpm start:dev` y, en otra terminal, `stripe listen ...`.
2. `POST /sale` con `{ productId, client, address }` → debe responder una `url` de
   `checkout.stripe.com`. Verificar que la fila en `sale` quedó `PENDING` con el `cs_test_...`
   en `stripedata`.
3. Abrir la `url`, pagar con `4242 4242 4242 4242`, cualquier fecha futura y CVC.
   El monto que muestra Stripe tiene que coincidir con el precio del Pokémon (US$100 para
   Pikachu, no US$1).
4. En la terminal de `stripe listen` debe aparecer `checkout.session.completed → 200`.
5. Confirmar: `GET /sale` → `COMPLETED`; `GET /pokemon/sold` → aparece el Pokémon.
6. Casos borde que vale la pena probar una vez:
   - Cerrar la pestaña de Stripe sin pagar: la venta debe quedar `PENDING` y el Pokémon
     disponible.
   - Tarjeta rechazada `4000 0000 0000 0002`: no debe llegar `completed`.
   - Reenviar el mismo evento (`stripe events resend <evt_id>`): no debe romper ni duplicar.
   - Webhook con firma inválida (`curl` a mano): debe responder 400.
   - Pokémon ya vendido: `POST /sale` debe fallar antes de tocar Stripe.

## 7. Puede esperar (no bloquea la prueba)

- Arreglar los tests y aislar la base (`:memory:` o un archivo por test).
- Validación de DTOs con `ValidationPipe` + `class-validator`.
- Sacar o proteger `POST /pokemon/:id/buy` y `POST/PATCH /pokemon` (no hay autenticación).
- Manejar `checkout.session.expired` para limpiar ventas `PENDING` viejas y reservar el
  Pokémon mientras hay una sesión abierta (carrera entre compradores).
- Reembolsos / cancelaciones, y pasar a claves `live` antes de desplegar.
- Limpieza de esquema (`address TEXT`, FK, índice único en la sesión de Stripe).
