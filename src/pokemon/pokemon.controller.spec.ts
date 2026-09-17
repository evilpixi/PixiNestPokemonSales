import { Test, TestingModule } from '@nestjs/testing';
import { PokemonController } from './pokemon.controller.js';
import { PokemonService } from './pokemon.service.js';
import { PokemonRepository } from './pokemon.repository.js';

describe('PokemonController', () => {
  let controller: PokemonController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PokemonController],
      providers: [PokemonService, PokemonRepository],
    }).compile();

    controller = module.get<PokemonController>(PokemonController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
