import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PokemonTypesModule } from './pokemon-types/pokemon-types.module.js';
import { PokemonModule } from './pokemon/pokemon.module.js';

@Module({
  imports: [PokemonTypesModule, PokemonModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
