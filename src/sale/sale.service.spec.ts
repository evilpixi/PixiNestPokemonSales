import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PokemonService } from '../pokemon/pokemon.service.js';
import { SaleRepository } from './sale.repository.js';
import { SaleService } from './sale.service.js';

const TEST_CONFIG: Record<string, string> = {
  STRIPE_SECRET_KEY: 'sk_test_dummy',
  STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
  FRONTEND_URL: 'http://localhost:3000',
};

function compileWith(config: Record<string, string>): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      SaleService,
      { provide: SaleRepository, useValue: {} },
      { provide: PokemonService, useValue: {} },
      {
        provide: ConfigService,
        useValue: {
          getOrThrow: (key: string) => config[key],
          get: (key: string, defaultValue?: unknown) => config[key] ?? defaultValue,
        },
      },
    ],
  }).compile();
}

describe('SaleService', () => {
  let service: SaleService;

  beforeEach(async () => {
    const module = await compileWith(TEST_CONFIG);

    service = module.get<SaleService>(SaleService);
  });

  it('fails at startup when FRONTEND_URL is not an absolute URL', async () => {
    await expect(compileWith({ ...TEST_CONFIG, FRONTEND_URL: '3000' })).rejects.toThrow(
      'FRONTEND_URL must be an absolute URL',
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects a webhook without the stripe-signature header', () => {
    expect(() => service.handleWebhookEvent(Buffer.from('{}'), undefined)).toThrow(
      'Missing stripe-signature header',
    );
  });

  it('rejects a webhook with an invalid signature', () => {
    expect(() => service.handleWebhookEvent(Buffer.from('{}'), 't=1,v1=bad')).toThrow(
      'Webhook signature verification failed',
    );
  });
});
