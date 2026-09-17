import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePokemonDto } from './dto/create-pokemon.dto.js';
import { UpdatePokemonDto } from './dto/update-pokemon.dto.js';
import { Pokemon } from './entities/pokemon.entity.js';
import POKEMON_LIST from './consts/pokemon-list.js';

@Injectable()
export class PokemonService {
  private pokemons: Pokemon[] = [...POKEMON_LIST];

  create(createPokemonDto: CreatePokemonDto) {
    const newID = this.pokemons.reduce((maxId, p) => Math.max(maxId, p.id), 0) + 1;
    const newPokemon = new Pokemon(newID, createPokemonDto);

    this.pokemons.push(newPokemon);

    return newPokemon;
  }

  findAll() {
    return this.pokemons;
  }

  findOne(id: number) {
    const pokemon = this.pokemons.find(p => p.id === id);

    if (!pokemon) throw new NotFoundException(`Pokemon with id ${id} not found`);

    return pokemon;
  }

  findAllAvailable() {
    return this.pokemons.filter(p => !p.sold);
  }

  findAllSold() {
    return this.pokemons.filter(p => p.sold);
  }

  update(id: number, updatePokemonDto: UpdatePokemonDto) {
    const pokemon = this.findOne(id);

    if (updatePokemonDto.name !== undefined) pokemon.name = updatePokemonDto.name;
    if (updatePokemonDto.level !== undefined) pokemon.level = updatePokemonDto.level;
    if (updatePokemonDto.price !== undefined) pokemon.price = updatePokemonDto.price;

    return pokemon;
  }

  buyPokemon(id: number) {
    const pokemon = this.findOne(id);

    if (pokemon.sold) throw new ConflictException(`Pokemon with id ${id} is already sold`);

    // apply charge here;

    pokemon.sold = true;

    return pokemon;
  }
}
