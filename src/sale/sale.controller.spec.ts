import { Test, TestingModule } from '@nestjs/testing';
import { SaleController } from './sale.controller.js';
import { SaleService } from './sale.service.js';

describe('SaleController', () => {
  let controller: SaleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaleController],
      providers: [{ provide: SaleService, useValue: {} }],
    }).compile();

    controller = module.get<SaleController>(SaleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('redirects the success page to the frontend', () => {
    expect(controller.success('cs_test_123')).toEqual({
      url: '/app/?checkout=success&session_id=cs_test_123',
    });
  });
});
