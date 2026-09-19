import { Module } from '@nestjs/common';
import { SaleService } from './sale.service.js';
import { SaleController } from './sale.controller.js';
import { SaleRepository } from './sale.repository.js';
import { PokemonModule } from '../pokemon/pokemon.module.js';

@Module({
  controllers: [SaleController],
  providers: [SaleService, SaleRepository],
  imports: [PokemonModule]
})
export class SaleModule {}
