import { Inject, Injectable } from "@nestjs/common";
import { db } from "../storage/db.js";
import { CreateSaleDto } from "./dto/create-sale.dto.js";
import { Sale } from "./entities/sale.entity.js";

type SaleRow = {
  id: number;
  client: string;
  address: string;
  productId: number;
  price: number;
  date: string;
  stripeData: string;
}

function rowToSale(row: SaleRow): Sale {
  return {
    id: row.id,
    client: row.client,
    address: row.address,
    productId: row.productId,
    price: row.price,
    date: row.date,
    stripeData: row.stripeData
  }
}

@Injectable()
export class SaleRepository {
  constructor() {}

  findById(id: number): Sale | undefined {
    const row = db.prepare('SELECT * FROM sale WHERE id = ?').get(id) as SaleRow | undefined;

    return row ? rowToSale(row) : undefined;
  }

  create(createSaleDto: CreateSaleDto): Sale {
    const s = createSaleDto;
    const { lastInsertRowid } = db
      .prepare('INSERT INTO sale (client, address, productid, price, date, stripedata VALUES (?, ?, ?, ?, ?, ?)')
      .run(s.client, s.address, s.productId, s.price, s.date, s.stripeData);

    return this.findById(Number(lastInsertRowid))!;
  }
}