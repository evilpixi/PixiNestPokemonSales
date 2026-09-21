import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Redirect,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SaleService } from './sale.service.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { UpdateSaleDto } from './dto/update-sale.dto.js';

@Controller('sale')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  // Creates the sale and returns the Stripe Checkout URL the buyer has to be sent to.
  @Post()
  create(@Body() createSaleDto: CreateSaleDto) {
    return this.saleService.create(createSaleDto);
  }

  @Get()
  findAll() {
    return this.saleService.findAll();
  }

  // Landing pages Stripe sends the buyer back to. They only redirect to the frontend:
  // the payment itself is confirmed by the webhook, never by this visit.
  // Static routes go before ':id' so they are not captured by it.
  @Get('success')
  @Redirect()
  success(@Query('session_id') sessionId?: string) {
    const query = sessionId ? `&session_id=${encodeURIComponent(sessionId)}` : '';

    return { url: `/app/?checkout=success${query}` };
  }

  @Get('cancel')
  @Redirect('/app/?checkout=cancel')
  cancel() {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    return this.saleService.handleWebhookEvent(req.rawBody!, signature);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.saleService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateSaleDto: UpdateSaleDto) {
    return this.saleService.update(id, updateSaleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.saleService.remove(id);
  }
}
