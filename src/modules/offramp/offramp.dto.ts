import { IsString, IsNumber, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum CryptoAsset {
  USDT = 'USDT',
  // TON and SOL are temporarily disabled for off-ramp
  // TON = 'TON',
  // SOL = 'SOL',
}

export enum PayoutDestination {
  INTERNAL_WALLET = 'INTERNAL_WALLET',
  SAVED_BANK = 'SAVED_BANK',
}

export class CreateOfframpRequestDto {
  @IsEnum(CryptoAsset)
  cryptoAsset: CryptoAsset;

  @IsNumber()
  cryptoAmount: number;

  @IsString()
  userBybitTxId: string;

  @IsOptional()
  @IsString()
  proofImageUrl?: string;

  @IsEnum(PayoutDestination)
  payoutDestination: PayoutDestination;

  @IsOptional()
  @IsUUID()
  savedBankId?: string;
}

export class ApproveOfframpRequestDto {
  @IsString()
  adminId: string;
}

export class RejectOfframpRequestDto {
  @IsString()
  reason?: string;
}

export class OfframpRequestResponse {
  id: string;
  userId: string;
  cryptoAsset: string;
  cryptoAmount: number;
  ngnValue: number;
  exchangeRate: number;
  bybitUidUsed: string;
  userBybitTxId: string;
  proofImageUrl?: string;
  payoutDestination: string;
  savedBankId?: string;
  status: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email?: string;
    username?: string;
    firstName?: string;
    telegramId?: bigint;
  };
  savedBank?: {
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

export class AdminOfframpQueueResponse {
  requests: OfframpRequestResponse[];
}