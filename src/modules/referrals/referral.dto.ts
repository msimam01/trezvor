import { IsString, IsNumber, IsOptional } from 'class-validator';

export class ProcessFirstDepositBonusDto {
  @IsString()
  refereeId: string;

  @IsNumber()
  depositAmount: number;
}

export class ProcessTransactionCommissionDto {
  @IsString()
  orderId: string;

  @IsNumber()
  platformFeeNgn: number;
}

export class ReferralStatsResponse {
  referralCode: string;
  referralLink: string;
  totalReferred: number;
  pendingBonuses: number;
  totalPaidBonuses: number;
  unpaidBalance: number;
}