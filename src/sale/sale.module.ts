import { Module } from '@nestjs/common';
import { SaleService } from './sale.service.js';
import { SaleController } from './sale.controller.js';
import { SaleRepository } from './sale.repository.js';
import { PokemonService } from '../pokemon/pokemon.service.js';

@Module({
  controllers: [SaleController],
  providers: [SaleService, SaleRepository],
  imports: [PokemonService]
})
export class SaleModule {}
