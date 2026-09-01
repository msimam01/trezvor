# Internal Wallet & Saved Bank Account Module - Implementation Summary

## Overview

This module implements an internal wallet system with saved bank accounts and withdrawal functionality using Paystack for Nigerian bank transfers.

## Database Schema Changes

### Updated Models

#### User Model (Extended)
- Added `nairaBalance` (Float, default 0.0) - Already existed
- Added relations to `savedBanks` and `walletTransactions`

#### New Enum: WalletTransactionType
```prisma
enum WalletTransactionType {
  REFERRAL_EARNING
  BONUS_DEPOSIT
  OFFRAMP_PAYOUT
  REFUND
  WITHDRAWAL
}
```

#### New Enum: WalletTransactionStatus
```prisma
enum WalletTransactionStatus {
  PENDING
  SUCCESS
  FAILED
}
```

#### New Model: SavedBank
```prisma
model SavedBank {
  id                    String   @id @default(uuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bankCode              String
  bankName              String
  accountNumber         String
  accountName           String
  paystackRecipientCode String?  @unique
  isVerified            Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

#### New Model: WalletTransaction
```prisma
model WalletTransaction {
  id          String                   @id @default(uuid())
  userId      String
  user        User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  amount      Float
  type        WalletTransactionType
  status      WalletTransactionStatus  @default(PENDING)
  reference   String                   @unique
  metadata    Json?
  createdAt   DateTime                 @default(now())
  updatedAt   DateTime                 @updatedAt
}
```

## NestJS Implementation

### Module Structure

```
src/modules/wallet/
├── wallet.module.ts           # Module definition
├── wallet.service.ts          # Business logic
├── wallet.controller.ts       # JWT-protected endpoints
└── wallet-public.controller.ts # Public endpoints (for Telegram Bot)
```

### WalletService

The service provides the following methods:

#### 1. `getBanks()`
- Fetches supported Nigerian banks from Paystack
- Returns array of bank objects with codes and names

#### 2. `resolveAndSaveBank(userId, accountNumber, bankCode)`
- Resolves account details with Paystack (`GET /bank/resolve`)
- Generates Paystack transfer recipient (`POST /transferrecipient`)
- Saves or updates bank account in database
- Returns account name, bank name, and recipient code

#### 3. `getWalletBalance(userId)`
- Returns user's naira balance
- Returns all saved bank accounts for the user

#### 4. `withdraw(userId, amount, bankAccountId)`
- Validates amount and balance
- Verifies bank account ownership
- Creates pending transaction
- Initiates Paystack transfer
- Deducts from balance on success
- Updates transaction status

#### 5. `addFunds(userId, amount, type, reference, metadata)`
- Helper method to add funds to wallet
- Increments user balance
- Creates SUCCESS transaction record
- Used for referrals, bonuses, refunds

### API Endpoints

#### JWT-Protected Endpoints (Web API)

**GET /api/v1/wallet/banks**
- Fetch supported Nigerian banks
- Requires JWT authentication

**POST /api/v1/wallet/bank/resolve**
- Resolve and save bank account
- Body: `{ accountNumber, bankCode }`
- Requires JWT authentication

**GET /api/v1/wallet/balance**
- Get wallet balance and saved banks
- Requires JWT authentication

**POST /api/v1/wallet/withdraw**
- Withdraw funds to saved bank
- Body: `{ amount, bankAccountId }`
- Requires JWT authentication

#### Public Endpoints (Telegram Bot)

**GET /api/v1/wallet/public/banks**
- Same as protected version

**POST /api/v1/wallet/public/bank/resolve**
- Body: `{ userId, accountNumber, bankCode }`
- No JWT required (userId in body)

**GET /api/v1/wallet/public/balance/:userId**
- Get balance by userId
- No JWT required

**POST /api/v1/wallet/public/withdraw**
- Body: `{ userId, amount, bankAccountId }`
- No JWT required (userId in body)

## Integration Points

### 1. App Module
The WalletModule is imported in `src/app.module.ts`:
```typescript
import { WalletModule } from './modules/wallet/wallet.module';

@Module({
  imports: [
    // ... other modules
    WalletModule,
  ],
})
```

### 2. Telegram Bot Integration
The public endpoints allow the Telegram bot to:
- Fetch bank lists for user selection
- Resolve and save bank accounts
- Check wallet balances
- Process withdrawals

Use the public endpoints with `userId` in the request body.

### 3. Web API Integration
The protected endpoints allow the Next.js web app to:
- Provide full wallet management UI
- Handle user authentication via JWT
- Secure wallet operations

### 4. Paystack Integration
The service integrates with Paystack APIs:
- `GET /bank` - Fetch Nigerian banks
- `GET /bank/resolve` - Resolve account details
- `POST /transferrecipient` - Create transfer recipient
- `POST /transfer` - Initiate bank transfer

**Required Environment Variable:**
```env
PAYSTACK_SECRET_KEY=your_paystack_secret_key
```

## Security Considerations

1. **JWT Authentication**: Web endpoints require valid JWT token
2. **Public Endpoints**: Telegram bot endpoints require userId validation
3. **Bank Account Ownership**: Withdrawals verify bank account belongs to user
4. **Balance Validation**: Withdrawals check sufficient balance before processing
5. **Idempotency**: Transactions use unique references to prevent duplicates
6. **Cascade Delete**: User deletion cascades to saved banks and transactions

## Error Handling

The service handles various error scenarios:
- Invalid account numbers (Paystack validation)
- Insufficient balance
- Bank account not found
- Bank account ownership mismatch
- Paystack API failures
- Network errors

## Testing

### Unit Tests
Unit tests are provided in `wallet.service.spec.ts` covering:
- Bank fetching
- Account resolution and saving
- Balance retrieval
- Withdrawal validation and processing
- Fund addition

### Integration Tests
See `WALLET_API_TEST.md` for step-by-step curl commands to verify:
- Bank list fetching
- Account resolution and recipient code generation
- Balance checking
- Withdrawal with balance validation
- Transaction record creation

## Usage Examples

### Adding Referral Earnings
```typescript
// In your referral service
await this.walletService.addFunds(
  userId,
  referralAmount,
  'REFERRAL_EARNING',
  `REF_${userId}_${Date.now()}`,
  { referrerId: referrerId }
);
```

### Processing Refunds
```typescript
// In your refund service
await this.walletService.addFunds(
  userId,
  refundAmount,
  'REFUND',
  `REFUND_${orderId}_${Date.now()}`,
  { orderId, reason }
);
```

### Telegram Bot Withdrawal
```typescript
// In your Telegram bot
const result = await this.httpService.post(
  'http://localhost:3000/api/v1/wallet/public/withdraw',
  {
    userId: telegramUser.id,
    amount: withdrawalAmount,
    bankAccountId: savedBankId,
  }
);
```

## Next Steps

### Web Frontend (Next.js)
To complete the full-stack implementation, you'll need to create:

1. **Wallet Balance Page**
   - Display current naira balance
   - Show transaction history
   - List saved bank accounts

2. **Add Bank Account Modal**
   - Bank selection dropdown
   - Account number input
   - Account name display (after resolution)
   - Save button

3. **Withdrawal Form**
   - Amount input
   - Bank account selection
   - Confirmation modal
   - Success/error feedback

4. **Transaction History**
   - List of all wallet transactions
   - Filter by type (withdrawal, referral, bonus, refund)
   - Status indicators

### Recommended API Client
Create a wallet API client in the Next.js app:

```typescript
// web/lib/api/wallet.ts
export async function getBanks(token: string) {
  const response = await fetch('/api/v1/wallet/banks', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function resolveBank(token: string, accountNumber: string, bankCode: string) {
  const response = await fetch('/api/v1/wallet/bank/resolve', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accountNumber, bankCode }),
  });
  return response.json();
}

export async function getBalance(token: string) {
  const response = await fetch('/api/v1/wallet/balance', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function withdraw(token: string, amount: number, bankAccountId: string) {
  const response = await fetch('/api/v1/wallet/withdraw', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount, bankAccountId }),
  });
  return response.json();
}
```

## Maintenance

### Database Migrations
The schema changes have been applied using `prisma db push`. For production:
```bash
npx prisma migrate deploy
```

### Monitoring
Monitor:
- Wallet transaction success rates
- Paystack API response times
- Failed withdrawal attempts
- Balance anomalies

### Scaling Considerations
- Consider implementing transaction limits
- Add withdrawal cooldown periods
- Implement fraud detection for large withdrawals
- Add webhook handlers for Paystack transfer callbacks
