import { Injectable } from '@nestjs/common';
import { CreatePokemonDto } from './dto/create-pokemon.dto.js';
import { UpdatePokemonDto } from './dto/update-pokemon.dto.js';
import { Pokemon } from './entities/pokemon.entity.js';

@Injectable()
export class PokemonService {
  private pokemons: Pokemon[] = [];

  create(createPokemonDto: CreatePokemonDto) {
    const newID = this.pokemons.length;
    const newPokemon = new Pokemon(newID, createPokemonDto);

    this.pokemons.push(newPokemon);

    return newPokemon;
  }

  findAll() {
    return this.pokemons;
  }

  findOne(id: number) {
    return this.pokemons.find(p => p.id == id);
  }

  findAllAvailable() {
    return this.pokemons.filter(p => !p.sold);
  }

  findAllSold() {
    return this.pokemons.filter(p => p.sold);
  }

  update(id: number, updatePokemonDto: UpdatePokemonDto) {
    const pokemon = this.pokemons.find(p => p.id == id);

    if (!pokemon) return;

    pokemon.name = updatePokemonDto.name || pokemon.name;
    pokemon.level = updatePokemonDto.level || pokemon.level;
  }

  buyPokemon(id: number) {
    const pokemon = this.pokemons.find(p => p.id == id);

    if (!pokemon)return;
    if (pokemon.sold) return;

    // apply charge here;

    pokemon.sold = true;
  }
}
