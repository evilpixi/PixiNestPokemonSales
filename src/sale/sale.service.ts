import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Pokemon } from '../pokemon/entities/pokemon.entity.js';
import { PokemonService } from '../pokemon/pokemon.service.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { UpdateSaleDto } from './dto/update-sale.dto.js';
import { SaleStatus } from './entities/sale.entity.js';
import { SaleRepository } from './sale.repository.js';

@Injectable()
export class SaleService {
  private readonly logger = new Logger(SaleService.name);
  private readonly stripe: Stripe;
  private readonly frontendUrl: string;
  private readonly port: number;

  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly pokemonService: PokemonService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-08-26.dahlia',
    });
    this.frontendUrl = config.getOrThrow<string>('FRONTEND_URL');
    this.port = config.get<number>('PORT', 5173);

    if (!URL.canParse(this.frontendUrl)) {
      throw new Error(`FRONTEND_URL must be an absolute URL such as http://localhost:3000 (got "${this.frontendUrl}")`);
    }
  }

  async create(createSaleDto: CreateSaleDto) {
    const pokemon = this.pokemonService.findOne(createSaleDto.productId);

    if (pokemon.sold) throw new ConflictException(`Pokemon with id ${pokemon.id} is already sold`);

    const session = await this.createCheckoutSession(pokemon);

    const sale = this.saleRepository.create({
      client: createSaleDto.client,
      address: createSaleDto.address,
      productId: pokemon.id,
      price: pokemon.price,
      stripeData: session.id,
    });

    return { sale, url: session.url };
  }

  findAll() {
    return this.saleRepository.findAll();
  }

  findOne(id: number) {
    const sale = this.saleRepository.findById(id);

    if (!sale) throw new NotFoundException(`Sale with id ${id} not found`);

    return sale;
  }

  update(id: number, updateSaleDto: UpdateSaleDto) {
    this.findOne(id);
    this.saleRepository.update(id, updateSaleDto);

    return this.findOne(id);
  }

  remove(id: number) {
    const sale = this.findOne(id);

    // A paid sale is the only local record of a real charge.
    if (sale.status === SaleStatus.COMPLETED) {
      throw new ConflictException(`Sale with id ${id} is completed and cannot be removed`);
    }

    this.saleRepository.remove(id);
  }

  async createCheckoutSession(pokemon: Pokemon) {
    try {
      return await this.stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(pokemon.price * 100),
              product_data: { name: pokemon.name },
            },
          },
        ],
        // {CHECKOUT_SESSION_ID} is a Stripe template: it must not be URL-encoded.
        success_url: `${this.buildUrl('/sale/success')}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: this.buildUrl('/sale/cancel'),
        metadata: { pokemonId: String(pokemon.id) },
      });
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        this.logger.error(`Stripe rejected the checkout session: ${error.message}`);
        throw new BadGatewayException(`Stripe error: ${error.message}`);
      }

      throw error;
    }
  }

  handleWebhookEvent(rawBody: Buffer, signature: string | undefined) {
    if (!signature) throw new BadRequestException('Missing stripe-signature header');

    // Read on demand: the whsec_ only exists once `stripe listen` (or the dashboard endpoint) is set up.
    const webhookSecret = this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';

      throw new BadRequestException(`Webhook signature verification failed: ${reason}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        this.completeSale(event.data.object);
        break;
      case 'checkout.session.expired':
        this.rejectSale(event.data.object);
        break;
    }

    // Stripe only needs a 2xx; anything else makes it retry the event.
    return { received: true };
  }

  private completeSale(session: Stripe.Checkout.Session) {
    const sale = this.saleRepository.findByStripeSessionId(session.id);

    if (!sale) {
      this.logger.error(`checkout.session.completed for unknown session ${session.id}`);
      return;
    }

    if (sale.status === SaleStatus.COMPLETED) return;
    if (session.payment_status !== 'paid') return;

    // Pokemon first: if we fail in between, Stripe's retry finds the sale still PENDING and finishes the job.
    this.pokemonService.markAsSold(sale.productId);
    this.saleRepository.markAsCompleted(sale.id);
  }

  private rejectSale(session: Stripe.Checkout.Session) {
    const sale = this.saleRepository.findByStripeSessionId(session.id);

    if (sale?.status === SaleStatus.PENDING) this.saleRepository.markAsRejected(sale.id);
  }

  // FRONTEND_URL may or may not carry a port; when it doesn't, use the port this server listens on.
  private buildUrl(path: string) {
    const url = new URL(this.frontendUrl);

    if (!url.port) url.port = String(this.port);
    url.pathname = path;

    return url.toString();
  }
}
