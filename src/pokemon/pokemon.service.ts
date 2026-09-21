import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePokemonDto } from './dto/create-pokemon.dto.js';
import { UpdatePokemonDto } from './dto/update-pokemon.dto.js';
import { PokemonRepository } from './pokemon.repository.js';

@Injectable()
export class PokemonService {
  constructor(private readonly pokemonRepository: PokemonRepository) {}

  create(createPokemonDto: CreatePokemonDto) {
    return this.pokemonRepository.create(createPokemonDto);
  }

  findAll() {
    return this.pokemonRepository.findAll();
  }

  findOne(id: number) {
    const pokemon = this.pokemonRepository.findById(id);

    if (!pokemon) throw new NotFoundException(`Pokemon with id ${id} not found`);

    return pokemon;
  }

  findAllAvailable() {
    return this.pokemonRepository.findAllAvailable();
  }

  findAllSold() {
    return this.pokemonRepository.findAllSold();
  }

  update(id: number, updatePokemonDto: UpdatePokemonDto) {
    this.findOne(id);
    this.pokemonRepository.update(id, updatePokemonDto);

    return this.findOne(id);
  }

  // Idempotent on purpose: the Stripe webhook can be delivered more than once.
  markAsSold(id: number) {
    const pokemon = this.findOne(id);

    if (pokemon.sold) return pokemon;

    this.pokemonRepository.markAsSold(id);

    return this.findOne(id);
  }

  buyPokemon(id: number) {
    const pokemon = this.findOne(id);

    if (pokemon.sold) throw new ConflictException(`Pokemon with id ${id} is already sold`);

    // apply charge here;

    this.pokemonRepository.markAsSold(id);

    return this.findOne(id);
  }
}
