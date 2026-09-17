import { Test, TestingModule } from '@nestjs/testing';
import { PokemonService } from './pokemon.service.js';
import { PokemonRepository } from './pokemon.repository.js';

describe('PokemonService', () => {
  let service: PokemonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PokemonService, PokemonRepository],
    }).compile();

    service = module.get<PokemonService>(PokemonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
