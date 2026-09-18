import { SaleStatus } from "../entities/sale.entity.js";

export class CreateSaleDto {
    public client: string;
    public address: string;
    public price: number;
    public productId: number;
    public stripeData: string;
    public date: string;
    public status: SaleStatus;
}
