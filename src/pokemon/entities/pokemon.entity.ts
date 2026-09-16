import { CreatePokemonDto } from "../dto/create-pokemon.dto.js";

export class Pokemon {
    public readonly id: number;
    public name: string = 'MissingNo';
    public level: number = 1;
    public sold: boolean = false;
    public price: number = 0;

    constructor(id: number, createPokemonDto: CreatePokemonDto) {
        this.id = id;
        this.name = createPokemonDto.name;
        this.level = createPokemonDto.level;
        this.price = createPokemonDto.price;
    }
}
