import { Injectable } from '@nestjs/common';
import { db } from '../storage/db.js';
import { CreatePokemonDto } from './dto/create-pokemon.dto.js';
import { UpdatePokemonDto } from './dto/update-pokemon.dto.js';
import { Pokemon } from './entities/pokemon.entity.js';
import POKEMON_LIST from './consts/pokemon-list.js';

type PokemonRow = {
  id: number;
  name: string;
  level: number;
  price: number;
  sold: number;
};

function rowToPokemon(row: PokemonRow): Pokemon {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    price: row.price,
    sold: Boolean(row.sold),
  };
}

@Injectable()
export class PokemonRepository {
  constructor() {
    this.seedIfEmpty();
  }

  private seedIfEmpty() {
    const { count } = db.prepare('SELECT COUNT(*) as count FROM pokemon').get() as {
      count: number;
    };

    if (count > 0) return;

    const insert = db.prepare('INSERT INTO pokemon (name, level, price, sold) VALUES (?, ?, ?, ?)');

    for (const pokemon of POKEMON_LIST) {
      insert.run(pokemon.name, pokemon.level, pokemon.price, pokemon.sold ? 1 : 0);
    }
  }

  create(createPokemonDto: CreatePokemonDto): Pokemon {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO pokemon (name, level, price, sold) VALUES (?, ?, ?, 0)')
      .run(createPokemonDto.name, createPokemonDto.level, createPokemonDto.price);

    return this.findById(Number(lastInsertRowid))!;
  }

  findAll(): Pokemon[] {
    const rows = db.prepare('SELECT * FROM pokemon').all() as PokemonRow[];

    return rows.map(rowToPokemon);
  }

  findAllAvailable(): Pokemon[] {
    const rows = db.prepare('SELECT * FROM pokemon WHERE sold = 0').all() as PokemonRow[];

    return rows.map(rowToPokemon);
  }

  findAllSold(): Pokemon[] {
    const rows = db.prepare('SELECT * FROM pokemon WHERE sold = 1').all() as PokemonRow[];

    return rows.map(rowToPokemon);
  }

  findById(id: number): Pokemon | undefined {
    const row = db.prepare('SELECT * FROM pokemon WHERE id = ?').get(id) as PokemonRow | undefined;

    return row ? rowToPokemon(row) : undefined;
  }

  update(id: number, updatePokemonDto: UpdatePokemonDto): void {
    const current = this.findById(id);

    if (!current) return;

    const name = updatePokemonDto.name ?? current.name;
    const level = updatePokemonDto.level ?? current.level;
    const price = updatePokemonDto.price ?? current.price;

    db.prepare('UPDATE pokemon SET name = ?, level = ?, price = ? WHERE id = ?').run(
      name,
      level,
      price,
      id,
    );
  }

  markAsSold(id: number): void {
    db.prepare('UPDATE pokemon SET sold = 1 WHERE id = ?').run(id);
  }
}
