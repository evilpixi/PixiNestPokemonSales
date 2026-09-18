import { CreateSaleDto } from "../dto/create-sale.dto.js";

export class Sale {
    public readonly id: number;
    public client: string;
    public address: string;
    public productId: number;
    public price: number;
    public date: string;
    public stripeData: string;
    private status: SaleStatus;

    constructor(id: number, createSaleDto: CreateSaleDto) {
        this.id = id;
        this.client = createSaleDto.client;
        this.address = createSaleDto.address;
        this.productId = createSaleDto.productId;
        this.price = createSaleDto.price;
        this.date = createSaleDto.date;
        this.stripeData = createSaleDto.stripeData;
        this.status = SaleStatus.PENDING;
    }

    setStatus(newStatus: SaleStatus) {
        this.status = newStatus;
    }

    getStatus(): SaleStatus {
        return this.status;
    }
}

export enum SaleStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    REJECTED = 'REJECTED'
}