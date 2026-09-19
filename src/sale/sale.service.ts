import { Injectable, NotAcceptableException, NotFoundException } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { UpdateSaleDto } from './dto/update-sale.dto.js';
import { SaleRepository } from './sale.repository.js';
import Stripe from 'stripe';
import { Pokemon } from '../pokemon/entities/pokemon.entity.js';
import { PokemonService } from '../pokemon/pokemon.service.js';

const port = process.env.PORT;
const frontendUrl = process.env.FRONTEND_URL;
const stripeKey = process.env.STRIPE_SECRET_KEY || '';

@Injectable()
export class SaleService {
  private readonly stripe: Stripe;

  constructor(
    private readonly saleRepository: SaleRepository, 
    private readonly pokemonService: PokemonService,
  ) {
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2026-08-26.dahlia'
    })
  }

  async create(createSaleDto: CreateSaleDto) {
    const pokemon = this.pokemonService.findOne(createSaleDto.productId);

    if (!pokemon) throw NotFoundException;
    if (pokemon.sold) throw NotAcceptableException;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: pokemon.price,
        product_data: {
          name: pokemon.name
        }
      }
    })

    const checkout = this.createCheckoutSession(pokemon.id, lineItems)
    return this.saleRepository.create(createSaleDto);
  }

  findAll() {
    return this.saleRepository.findAll();
  }

  findOne(id: number) {
    return this.saleRepository.findById(id);
  }

  async createCheckoutSession(
    pokemonId: number, 
    items:     Stripe.Checkout.SessionCreateParams.LineItem[],
  ) {
    return this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items,
      success_url: `${frontendUrl}:${port}/success`,
      cancel_url:  `${frontendUrl}:${port}/cancel`,
      metadata: { pokemonId: pokemonId }
    });
  }
}
