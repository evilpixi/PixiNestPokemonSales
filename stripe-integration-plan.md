# Plan de integración de Stripe — Sale module

> Objetivo: cuando alguien "compra" un Pokémon, se crea una sesión de pago en Stripe,
> el comprador paga, y cuando Stripe confirma el pago (vía webhook) marcamos el
> Pokémon como vendido y guardamos el registro en la tabla `sale`.

## Estado del proyecto (contexto para retomar en otro chat)

- Backend: NestJS 12, ESM (`"type": "module"`), imports locales con extensión `.js`.
- Persistencia: **sin ORM**, se usa `node:sqlite` (`DatabaseSync`) directo. Ver
  [src/storage/db.ts](src/storage/db.ts) — ahí vive la tabla `pokemon`.
- Patrón de referencia a copiar: [src/pokemon/pokemon.repository.ts](src/pokemon/pokemon.repository.ts)
  (repositorio con SQL a mano) + [src/pokemon/pokemon.service.ts](src/pokemon/pokemon.service.ts).
- `src/sale/` existe pero es boilerplate vacío (`nest g resource sale`): entity, dto,
  service y controller son stubs sin implementar.
- Frontend: HTML/JS estático en `frontend/`, servido en `/app` vía `ServeStaticModule`
  (ver [src/app.module.ts](src/app.module.ts)).
- Ya instalado: `stripe` (SDK oficial) y `@nestjs/config` (para leer `.env`).
- Falta: registrar `ConfigModule` en `app.module.ts`, y todo lo de este plan.

## Conceptos clave de Stripe (antes de codear)

- **Claves API**: `sk_test_...` (secreta, sólo backend) y `pk_test_...` (pública, si
  algún día usás Stripe Elements/JS del lado del cliente). En modo test no se cobra plata real.
- **Checkout Session**: la forma más simple de cobrar. Vos le decís a Stripe "quiero
  cobrar $X por este producto", Stripe te devuelve una URL, redirigís al comprador ahí,
  y Stripe se encarga del formulario de pago. No manejás número de tarjeta nunca.
- **Webhook**: Stripe te avisa de forma asíncrona (con un POST a tu servidor) cuándo
  un pago se completó. **Nunca confíes en que el usuario vuelva a tu `success_url`**
  para marcar algo como pagado — el usuario puede cerrar la pestaña. El webhook es la
  única fuente de verdad.
- **Firma del webhook**: Stripe firma cada evento con un secreto (`whsec_...`) para que
  nadie pueda mandarte un POST falso diciendo "ya pagaron". Hay que verificar esa firma
  contra el **body crudo** (raw bytes), no contra el JSON ya parseado por Express.
- **Tarjeta de prueba**: `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC.

## Arquitectura propuesta

```
Frontend                Backend (NestJS)                  Stripe
   |                          |                              |
   | POST /sale/checkout/:id  |                               |
   |------------------------->| crea Checkout Session         |
   |                          |------------------------------>|
   |                          |<-------- session.url ---------|
   |<---- { url } ------------|                               |
   |                                                            |
   | redirect a session.url (el usuario paga en Stripe)         |
   |----------------------------------------------------------->|
   |                                                            |
   |                          |<--- POST /sale/webhook --------|
   |                          |  (checkout.session.completed)  |
   |                          | marca pokemon vendido +        |
   |                          | guarda registro Sale           |
```

## Pasos

### Paso 0 — Dependencias ✅ (ya hecho)
`stripe` y `@nestjs/config` instalados.

### Paso 1 — Cuenta y claves de Stripe
- [ ] Crear cuenta en Stripe (o usar una existente) y quedarse en **modo test**.
- [ ] Copiar `sk_test_...` y `pk_test_...` desde el Dashboard → Developers → API keys.
- [ ] Agregar a tu `.env` (no lo subas al repo, chequeá que esté en `.gitignore`):
  ```
  STRIPE_SECRET_KEY=sk_test_xxx
  STRIPE_WEBHOOK_SECRET=       # lo completamos en el paso 5
  FRONTEND_URL=http://localhost:3000
  ```
- [ ] Registrar `ConfigModule` en [src/app.module.ts](src/app.module.ts):
  **Pista:** `ConfigModule.forRoot({ isGlobal: true })` en el array de `imports`. Con
  `isGlobal: true` no hace falta volver a importarlo en `SaleModule`.

### Paso 2 — Tabla `sale` en SQLite
Editar [src/storage/db.ts](src/storage/db.ts) y agregar un segundo `CREATE TABLE IF NOT EXISTS`
después del de `pokemon`, siguiendo el mismo estilo.

**Pista de columnas a incluir:**
`id`, `pokemon_id` (FK a `pokemon.id`), `amount` (en centavos, como usa Stripe),
`currency`, `stripe_session_id` (para poder buscar la sesión luego), `status`
(`'pending' | 'paid'`), `created_at`.

### Paso 3 — Entity + Repository de Sale
Copiar el patrón de `pokemon.repository.ts` pero para ventas.

- [ ] Completar [src/sale/entities/sale.entity.ts](src/sale/entities/sale.entity.ts) con los
  campos de la tabla (mirá cómo lo hace [src/pokemon/entities/pokemon.entity.ts](src/pokemon/entities/pokemon.entity.ts)).
- [ ] Crear `src/sale/sale.repository.ts` con métodos:
  - `create(pokemonId, amount, currency, stripeSessionId)` → status inicial `'pending'`
  - `findByStripeSessionId(sessionId)`
  - `markAsPaid(sessionId)`
- [ ] Registrar `SaleRepository` como `provider` en [src/sale/sale.module.ts](src/sale/sale.module.ts)
  (igual que `PokemonRepository` en `pokemon.module.ts`).

### Paso 4 — Crear la Checkout Session
En [src/sale/sale.service.ts](src/sale/sale.service.ts):

- [ ] Instanciar Stripe **una sola vez**, inyectando `ConfigService` en el constructor
  del servicio para leer `STRIPE_SECRET_KEY`.
- [ ] Método `createCheckoutSession(pokemonId: number)`:
  1. Buscar el pokemon con `PokemonRepository` (inyectalo en `SaleService`), si no
     existe o ya está `sold`, tirar `NotFoundException`/`BadRequestException`.
  2. Llamar `stripe.checkout.sessions.create({...})`. Claves importantes del objeto:
     - `mode: 'payment'`
     - `line_items: [{ price_data: { currency: 'usd', unit_amount: pokemon.price * 100, product_data: { name: pokemon.name } }, quantity: 1 }]`
     - `success_url` / `cancel_url` (usar `FRONTEND_URL` del `.env`)
     - `metadata: { pokemonId: String(pokemonId) }` ⚠️ esto es clave: es la forma de
       que el webhook sepa **qué pokemon** se pagó.
  3. Guardar un registro `sale` en estado `pending` con `saleRepository.create(...)`,
     usando `session.id` y `session.amount_total`.
  4. Devolver `{ url: session.url }` al controller.
- [ ] En [src/sale/sale.controller.ts](src/sale/sale.controller.ts), agregar
  `@Post('checkout/:pokemonId')` que llame a ese método.

### Paso 5 — Webhook
Esta es la parte más delicada. Dos cosas hay que resolver: **acceso al raw body** y
**verificación de firma**.

- [ ] En [src/main.ts](src/main.ts), pasar `{ rawBody: true }` como segundo argumento
  de `NestFactory.create(AppModule, { rawBody: true })`. Esto hace que Nest guarde el
  buffer crudo en `request.rawBody` sin dejar de parsear el JSON normalmente para el
  resto de tus rutas.
- [ ] Agregar `@Post('webhook')` en `SaleController` que reciba:
  - `@Req() req` (tipo `RawBodyRequest<Request>` de `@nestjs/common`)
  - `@Headers('stripe-signature') signature: string`
- [ ] En `SaleService`, método `handleWebhookEvent(rawBody: Buffer, signature: string)`:
  1. `const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`
     — esto lanza una excepción si la firma no matchea (protección contra requests falsos).
  2. `if (event.type === 'checkout.session.completed')`:
     - Sacar `session.metadata.pokemonId` y `session.id`.
     - `pokemonRepository.markAsSold(pokemonId)`.
     - `saleRepository.markAsPaid(session.id)`.
  3. Devolver `{ received: true }` (Stripe espera un 2xx, si no reintenta).
- [ ] Obtener `STRIPE_WEBHOOK_SECRET` (paso 6) y completarlo en `.env`.

### Paso 6 — Probar en local con Stripe CLI
- [ ] Instalar [Stripe CLI](https://stripe.com/docs/stripe-cli) y hacer `stripe login`.
- [ ] Correr: `stripe listen --forward-to localhost:3000/sale/webhook`
  — esto imprime un `whsec_...` **temporal**, copialo a tu `.env` como
  `STRIPE_WEBHOOK_SECRET`.
- [ ] Levantar el server (`pnpm start:dev`) y probar el flujo completo:
  1. `POST /sale/checkout/1` → te da una `url`.
  2. Abrí esa `url`, pagá con la tarjeta de prueba `4242 4242 4242 4242`.
  3. Mirá la consola: la CLI de Stripe debería reenviar el evento a tu webhook y verlo
     loguearse.
  4. Confirmá en la DB que el pokemon quedó `sold = 1` y que la tabla `sale` tiene el
     registro en `paid`.

### Paso 7 — Conectar el frontend (opcional, al final)
En `frontend/app.js`, el botón de "comprar" hace:
```js
const res = await fetch(`/sale/checkout/${pokemonId}`, { method: 'POST' });
const { url } = await res.json();
window.location.href = url;
```

## Cosas para más adelante (no ahora)
- Manejar `checkout.session.expired` (limpiar sales `pending` viejas).
- Idempotencia: si Stripe reintenta el webhook, `markAsPaid` no debería romper si ya
  estaba pagado.
- Refunds / cancelaciones.
- Pasar de modo test a claves live antes de un despliegue real.

## Cómo retomar esto en otro chat
Pegá este archivo (`stripe-integration-plan.md`) o decile a Claude que lo lea, y
decile en qué paso estás. Cada paso tiene pistas de código pero no la solución
completa a propósito — la idea es que lo escribas vos y pidas ayuda puntual cuando
te trabes.
