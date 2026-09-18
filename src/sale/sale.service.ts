import { Injectable } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { UpdateSaleDto } from './dto/update-sale.dto.js';
import { SaleRepository } from './sale.repository.js';

@Injectable()
export class SaleService {
  constructor(private readonly saleRepository: SaleRepository) {}

  create(createSaleDto: CreateSaleDto) {
    return this.saleRepository.create(createSaleDto);
  }

  findAll() {
    return this.saleRepository.findAll();
  }

  findOne(id: number) {
    return this.saleRepository.findById(id);
  }
}
