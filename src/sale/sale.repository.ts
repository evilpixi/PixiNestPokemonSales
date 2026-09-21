import { Injectable } from "@nestjs/common";
import { db } from "../storage/db.js";
import { UpdateSaleDto } from "./dto/update-sale.dto.js";
import { NewSale, Sale, SaleStatus } from "./entities/sale.entity.js";

// Keys match the column names declared in db.ts (SQLite keeps them lowercase).
type SaleRow = {
  id: number;
  client: string;
  address: string;
  productid: number;
  price: number;
  date: string;
  stripedata: string;
  status: SaleStatus;
}

function rowToSale(row: SaleRow): Sale {
  return new Sale(row.id, {
    client: row.client,
    address: row.address,
    productId: row.productid,
    price: row.price,
    date: row.date,
    stripeData: row.stripedata,
    status: row.status
  })
}

@Injectable()
export class SaleRepository {
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

  create(newSale: NewSale): Sale {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO sale (client, address, productid, price, stripedata, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(newSale.client, newSale.address, newSale.productId, newSale.price, newSale.stripeData, SaleStatus.PENDING);

    return this.findById(Number(lastInsertRowid))!;
  }

  update(id: number, updateSaleDto: UpdateSaleDto): void {
    const current = this.findById(id);

    if (!current) return;

    const client = updateSaleDto.client ?? current.client;
    const address = updateSaleDto.address ?? current.address;

    db.prepare('UPDATE sale SET client = ?, address = ? WHERE id = ?').run(client, address, id);
  }

  markAsCompleted(id: number): Sale | undefined {
    db.prepare('UPDATE sale SET status = ? WHERE id = ?').run(SaleStatus.COMPLETED, id);

    return this.findById(id);
  }

  markAsRejected(id: number): Sale | undefined {
    db.prepare('UPDATE sale SET status = ? WHERE id = ?').run(SaleStatus.REJECTED, id);

    return this.findById(id);
  }

  remove(id: number): void {
    db.prepare('DELETE FROM sale WHERE id = ?').run(id);
  }
}
