import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateSaleDto } from './create-sale.dto.js';

// Only the buyer's contact data can change; product, price and status are managed by the server.
export class UpdateSaleDto extends PartialType(PickType(CreateSaleDto, ['client', 'address'] as const)) {}
