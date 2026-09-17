import { Module } from '@nestjs/common';
import { PokemonService } from './pokemon.service.js';
import { PokemonController } from './pokemon.controller.js';
import { PokemonRepository } from './pokemon.repository.js';

@Module({
  controllers: [PokemonController],
  providers: [PokemonService, PokemonRepository],
})
export class PokemonModule {}
