import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import Stripe from 'stripe';
import { AppModule } from './../src/app.module.js';
import { db } from './../src/storage/db.js';
import { PokemonService } from './../src/pokemon/pokemon.service.js';
import { SaleRepository } from './../src/sale/sale.repository.js';
import { SaleStatus } from './../src/sale/entities/sale.entity.js';

const WEBHOOK_SECRET = 'whsec_e2e_test_secret';
const TEST_CONFIG: Record<string, string> = {
  STRIPE_SECRET_KEY: 'sk_test_e2e_dummy',
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  FRONTEND_URL: 'http://localhost:3000',
};

describe('Sale (e2e, no Stripe network)', () => {
  let app: INestApplication;
  let pokemonService: PokemonService;
  let saleRepository: SaleRepository;
  const createdPokemonIds: number[] = [];
  const stripe = new Stripe('sk_test_e2e_dummy');

  function signedHeader(payload: string) {
    return stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  }

  function completedEvent(sessionId: string, paymentStatus = 'paid') {
    return JSON.stringify({
      id: 'evt_e2e',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: sessionId, object: 'checkout.session', payment_status: paymentStatus } },
    });
  }

  function newPendingSale() {
    const pokemon = pokemonService.create({ name: 'E2E Mon', level: 1, price: 0.12 });
    createdPokemonIds.push(pokemon.id);

    const sessionId = `cs_test_e2e_${Date.now()}_${pokemon.id}`;
    const sale = saleRepository.create({
      client: 'E2E',
      address: 'Nowhere 1',
      productId: pokemon.id,
      price: pokemon.price,
      stripeData: sessionId,
    });

    return { pokemon, sale, sessionId };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: (key: string) => TEST_CONFIG[key],
        get: (key: string, defaultValue?: unknown) => TEST_CONFIG[key] ?? defaultValue,
      })
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();

    pokemonService = app.get(PokemonService);
    saleRepository = app.get(SaleRepository);
  });

  afterAll(async () => {
    for (const id of createdPokemonIds) {
      db.prepare('DELETE FROM sale WHERE productid = ?').run(id);
      db.prepare('DELETE FROM pokemon WHERE id = ?').run(id);
    }

    await app.close();
  });

  it('marks the sale as COMPLETED and the pokemon as sold on a signed checkout.session.completed', async () => {
    const { pokemon, sale, sessionId } = newPendingSale();
    const payload = completedEvent(sessionId);

    await request(app.getHttpServer())
      .post('/sale/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signedHeader(payload))
      .send(payload)
      .expect(200)
      .expect({ received: true });

    expect(saleRepository.findById(sale.id)?.status).toBe(SaleStatus.COMPLETED);
    expect(pokemonService.findOne(pokemon.id).sold).toBe(true);
  });

  it('is idempotent when Stripe delivers the same event twice', async () => {
    const { pokemon, sale, sessionId } = newPendingSale();
    const payload = completedEvent(sessionId);

    for (let attempt = 0; attempt < 2; attempt++) {
      await request(app.getHttpServer())
        .post('/sale/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signedHeader(payload))
        .send(payload)
        .expect(200);
    }

    expect(saleRepository.findById(sale.id)?.status).toBe(SaleStatus.COMPLETED);
    expect(pokemonService.findOne(pokemon.id).sold).toBe(true);
  });

  it('does not complete the sale when the session is not paid', async () => {
    const { pokemon, sale, sessionId } = newPendingSale();
    const payload = completedEvent(sessionId, 'unpaid');

    await request(app.getHttpServer())
      .post('/sale/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signedHeader(payload))
      .send(payload)
      .expect(200);

    expect(saleRepository.findById(sale.id)?.status).toBe(SaleStatus.PENDING);
    expect(pokemonService.findOne(pokemon.id).sold).toBe(false);
  });

  it('marks a pending sale as REJECTED on checkout.session.expired', async () => {
    const { pokemon, sale, sessionId } = newPendingSale();
    const payload = JSON.stringify({
      id: 'evt_e2e_expired',
      object: 'event',
      type: 'checkout.session.expired',
      data: { object: { id: sessionId, object: 'checkout.session' } },
    });

    await request(app.getHttpServer())
      .post('/sale/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signedHeader(payload))
      .send(payload)
      .expect(200);

    expect(saleRepository.findById(sale.id)?.status).toBe(SaleStatus.REJECTED);
    expect(pokemonService.findOne(pokemon.id).sold).toBe(false);
  });

  it('answers 2xx for an unknown session so Stripe does not retry forever', async () => {
    const payload = completedEvent('cs_test_does_not_exist');

    await request(app.getHttpServer())
      .post('/sale/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signedHeader(payload))
      .send(payload)
      .expect(200);
  });

  it('rejects a webhook with a bad signature (400) and does not touch the sale', async () => {
    const { pokemon, sale, sessionId } = newPendingSale();
    const payload = completedEvent(sessionId);

    await request(app.getHttpServer())
      .post('/sale/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=deadbeef')
      .send(payload)
      .expect(400);

    expect(saleRepository.findById(sale.id)?.status).toBe(SaleStatus.PENDING);
    expect(pokemonService.findOne(pokemon.id).sold).toBe(false);
  });

  it('rejects a webhook without the signature header (400)', async () => {
    await request(app.getHttpServer())
      .post('/sale/webhook')
      .set('Content-Type', 'application/json')
      .send(completedEvent('cs_test_x'))
      .expect(400);
  });

  it('redirects /sale/success and /sale/cancel to the frontend', async () => {
    await request(app.getHttpServer())
      .get('/sale/success?session_id=cs_test_abc')
      .expect(302)
      .expect('Location', '/app/?checkout=success&session_id=cs_test_abc');

    await request(app.getHttpServer())
      .get('/sale/cancel')
      .expect(302)
      .expect('Location', '/app/?checkout=cancel');
  });

  it('refuses to start a checkout for an already sold pokemon (409) before calling Stripe', async () => {
    const { pokemon } = newPendingSale();
    pokemonService.markAsSold(pokemon.id);

    await request(app.getHttpServer())
      .post('/sale')
      .send({ client: 'E2E', address: 'Nowhere 1', productId: pokemon.id })
      .expect(409);
  });

  it('serves a sale by id, 404 when missing and 400 for a non numeric id', async () => {
    const { sale, pokemon } = newPendingSale();

    const res = await request(app.getHttpServer()).get(`/sale/${sale.id}`).expect(200);
    expect(res.body).toMatchObject({
      id: sale.id,
      productId: pokemon.id,
      price: 0.12,
      status: SaleStatus.PENDING,
    });

    await request(app.getHttpServer()).get('/sale/999999').expect(404);
    await request(app.getHttpServer()).get('/sale/abc').expect(400);
  });

  it('updates client/address only, and refuses to delete a COMPLETED sale', async () => {
    const { sale, sessionId } = newPendingSale();

    const patched = await request(app.getHttpServer())
      .patch(`/sale/${sale.id}`)
      .send({ address: 'New address 2', price: 999, status: 'COMPLETED' })
      .expect(200);
    expect(patched.body).toMatchObject({ address: 'New address 2', price: 0.12, status: SaleStatus.PENDING });

    const payload = completedEvent(sessionId);
    await request(app.getHttpServer())
      .post('/sale/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signedHeader(payload))
      .send(payload)
      .expect(200);

    await request(app.getHttpServer()).delete(`/sale/${sale.id}`).expect(409);
  });

  it('deletes a PENDING sale (204)', async () => {
    const { sale } = newPendingSale();

    await request(app.getHttpServer()).delete(`/sale/${sale.id}`).expect(204);
    await request(app.getHttpServer()).get(`/sale/${sale.id}`).expect(404);
  });
});
