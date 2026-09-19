import { Inject, Injectable } from "@nestjs/common";
import { db } from "../storage/db.js";
import { CreateSaleDto } from "./dto/create-sale.dto.js";
import { Sale, SaleStatus } from "./entities/sale.entity.js";

type SaleRow = {
  id: number;
  client: string;
  address: string;
  productId: number;
  price: number;
  date: string;
  stripeData: string;
  status: SaleStatus;
}

function rowToSale(row: SaleRow): Sale {
  return new Sale(row.id, {
    client: row.client,
    address: row.address,
    productId: row.productId,
    price: row.price,
    date: row.date,
    stripeData: row.stripeData,
    status: row.status
  })
}

@Injectable()
export class SaleRepository {
  constructor() {}

  findAll(): Sale[] {
    const rows = db.prepare('SELECT * FROM sale').all() as SaleRow[]
    
    return rows.map(rowToSale)
  }

  findById(id: number): Sale | undefined {
    const row = db.prepare('SELECT * FROM sale WHERE id = ?').get(id) as SaleRow | undefined;

    return row ? rowToSale(row) : undefined;
  }

  findByStripeSessionId(stripeSessionId: string): Sale | undefined {
    const row = db.prepare('SELECT * FROM sale WHERE stripedata = ?').get(stripeSessionId) as SaleRow | undefined;

    return row ? rowToSale(row) : undefined;
  }

  markAsCompleted(id: number): Sale | undefined {
    db.prepare('UPDATE sale SET status = ? WHERE id = ?').run(SaleStatus.COMPLETED, id);

    return this.findById(id);
  }

  markAsRejected(id: number): Sale | undefined {
    db.prepare('UPDATE sale SET status = ? WHERE id = ?').run(SaleStatus.REJECTED, id);

    return this.findById(id);
  }

  create(createSaleDto: CreateSaleDto): Sale {
    const s = createSaleDto;
    const { lastInsertRowid } = db
      .prepare('INSERT INTO sale (client, address, productid, price, date, stripedata, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(s.client, s.address, s.productId, s.price, s.date, s.stripeData, s.status);

    return this.findById(Number(lastInsertRowid))!;
  }
}