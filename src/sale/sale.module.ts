import { Module } from '@nestjs/common';
import { SaleService } from './sale.service.js';
import { SaleController } from './sale.controller.js';
import { SaleRepository } from './sale.repository.js';

@Module({
  controllers: [SaleController],
  providers: [SaleService, SaleRepository],
})
export class SaleModule {}
