export enum SaleStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    REJECTED = 'REJECTED'
}

export type SaleData = {
    client: string;
    address: string;
    productId: number;
    price: number;
    date: string;
    stripeData: string;
    status: SaleStatus;
}

// What the service provides when it creates a sale; `date` and `status` are set by the repository.
export type NewSale = Omit<SaleData, 'date' | 'status'>;

export class Sale {
    public readonly id: number;
    public client: string;
    public address: string;
    public productId: number;
    public price: number;
    public date: string;
    public stripeData: string;
    public status: SaleStatus;

    constructor(id: number, data: SaleData) {
        this.id = id;
        this.client = data.client;
        this.address = data.address;
        this.productId = data.productId;
        this.price = data.price;
        this.date = data.date;
        this.stripeData = data.stripeData;
        this.status = data.status;
    }
}
