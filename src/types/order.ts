export type OrderStatus =
  | 'pending'
  | 'routing'
  | 'building'
  | 'submitted'
  | 'confirmed'
  | 'failed';

export type SupportedOrderType = 'market';

export interface CreateOrderDto {
  tokenIn: string;
  tokenOut: string;
  amount: number;
  wallet?: string;
  orderType?: SupportedOrderType;
}

export interface OrderJobData {
  id: string;
  payload: CreateOrderDto;
  createdAt: string;
}

export interface StatusUpdate {
  orderId: string;
  status: OrderStatus;
  timestamp: string;
  detail?: unknown;
}

export interface DexQuote {
  dex: 'raydium' | 'meteora';
  price: number;
  feeBps: number;
  expectedOutput: number;
  latencyMs: number;
}

export interface ExecutionResult {
  dex: 'raydium' | 'meteora';
  txHash: string;
  executedPrice: number;
  outputAmount: number;
}

