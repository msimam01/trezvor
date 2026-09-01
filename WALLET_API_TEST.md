# Wallet API Verification Tests

This document provides step-by-step curl commands to verify the Internal Wallet & Saved Bank Account module functionality.

## Prerequisites

- Backend server running on `http://localhost:3000`
- Valid Paystack secret key configured in `.env`
- A registered user with valid JWT token

## Test Setup

### 1. Register/Login to get JWT token

```bash
# Register a new user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "username": "testuser",
    "firstName": "Test"
  }'

# Or login if user exists
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the `access_token` from the response for subsequent requests.

## Test 1: Fetch Supported Nigerian Banks

**Endpoint:** `GET /api/v1/wallet/banks`

```bash
curl -X GET http://localhost:3000/api/v1/wallet/banks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
[
  {
    "name": "Access Bank",
    "code": "044",
    "longcode": "044",
    "gateway": "access",
    "pay_with_bank": true,
    "active": true,
    "country": "Nigeria",
    "currency": "NGN",
    "type": "nuban",
    "id": 1,
    "slug": "access-bank"
  }
  // ... more banks
]
```

## Test 2: Resolve and Save Bank Account

**Endpoint:** `POST /api/v1/wallet/bank/resolve`

This test:
1. Resolves account details with Paystack
2. Generates Paystack `recipient_code`
3. Saves to `SavedBank` table

```bash
curl -X POST http://localhost:3000/api/v1/wallet/bank/resolve \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "1234567890",
    "bankCode": "044"
  }'
```

**Expected Response:**
```json
{
  "accountName": "JOHN DOE",
  "bankName": "Access Bank",
  "paystackRecipientCode": "RCP_xxxxxxxxx"
}
```

**Alternative (Public API for Telegram Bot):**
```bash
curl -X POST http://localhost:3000/api/v1/wallet/public/bank/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_FROM_DB",
    "accountNumber": "1234567890",
    "bankCode": "044"
  }'
```

## Test 3: Get Wallet Balance

**Endpoint:** `GET /api/v1/wallet/balance`

```bash
curl -X GET http://localhost:3000/api/v1/wallet/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "nairaBalance": 0.0,
  "savedBanks": [
    {
      "id": "bank-account-id",
      "bankName": "Access Bank",
      "accountNumber": "1234567890",
      "accountName": "JOHN DOE",
      "isVerified": true
    }
  ]
}
```

**Alternative (Public API):**
```bash
curl -X GET http://localhost:3000/api/v1/wallet/public/balance/USER_ID_FROM_DB
```

## Test 4: Add Funds to Wallet (for testing withdrawal)

This is a helper operation to add test funds. You can use the `addFunds` method in the service or manually update the database:

```bash
# Using Prisma Studio or SQL
# UPDATE "User" SET "nairaBalance" = 5000.0 WHERE "id" = 'USER_ID';
```

Or create a test endpoint temporarily.

## Test 5: Withdraw Funds

**Endpoint:** `POST /api/v1/wallet/withdraw`

This test:
1. Validates amount > 0
2. Checks if amount <= nairaBalance
3. Validates bank account belongs to user
4. Deducts from nairaBalance
5. Creates WalletTransaction record
6. Triggers Paystack Transfer

```bash
curl -X POST http://localhost:3000/api/v1/wallet/withdraw \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "bankAccountId": "bank-account-id-from-test-2"
  }'
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Withdrawal processed successfully",
  "transactionId": "transaction-id",
  "reference": "WD_USER_ID_TIMESTAMP"
}
```

**Expected Response (Insufficient Balance):**
```json
{
  "statusCode": 400,
  "message": "Insufficient balance",
  "error": "Bad Request"
}
```

**Expected Response (Invalid Amount):**
```json
{
  "statusCode": 400,
  "message": "Amount must be greater than 0",
  "error": "Bad Request"
}
```

**Alternative (Public API):**
```bash
curl -X POST http://localhost:3000/api/v1/wallet/public/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_FROM_DB",
    "amount": 1000,
    "bankAccountId": "bank-account-id"
  }'
```

## Test 6: Verify WalletTransaction Record

After a successful withdrawal, verify the transaction was created:

```bash
# Using Prisma Studio or SQL query
# SELECT * FROM "WalletTransaction" WHERE "userId" = 'USER_ID' ORDER BY "createdAt" DESC LIMIT 1;
```

**Expected Fields:**
- `id`: UUID
- `userId`: User ID
- `amount`: Withdrawal amount
- `type`: "WITHDRAWAL"
- `status`: "SUCCESS" or "FAILED"
- `reference`: Unique reference (e.g., "WD_USER_ID_TIMESTAMP")
- `metadata`: JSON with bank details and transfer info

## Test 7: Verify Balance Deduction

Check that the user's balance was deducted:

```bash
curl -X GET http://localhost:3000/api/v1/wallet/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

The `nairaBalance` should be reduced by the withdrawal amount.

## Test 8: Test Duplicate Bank Account Resolution

Try resolving the same bank account again - it should update the existing record instead of creating a duplicate:

```bash
curl -X POST http://localhost:3000/api/v1/wallet/bank/resolve \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "1234567890",
    "bankCode": "044"
  }'
```

This should update the existing `SavedBank` record with a new `paystackRecipientCode` if needed.

## Acceptance Criteria Verification

### ✅ Resolving a dummy bank account successfully generates a Paystack `recipient_code`
- Test 2 verifies that the `resolveAndSaveBank` endpoint:
  - Calls Paystack's bank resolve API
  - Creates a transfer recipient
  - Returns the `paystackRecipientCode`
  - Saves the bank account to the database

### ✅ Withdrawal requests reject if `amount > nairaBalance`
- Test 5 with an amount greater than balance should return:
  - HTTP 400 Bad Request
  - Message: "Insufficient balance"
  - No balance deduction
  - No transaction created

### ✅ Successful withdrawal deducts `nairaBalance` and creates a `WalletTransaction` record
- Test 5 with sufficient balance should:
  - Deduct the amount from `nairaBalance`
  - Create a `WalletTransaction` with:
    - `type`: "WITHDRAWAL"
    - `status`: "SUCCESS"
    - Valid `reference`
    - Metadata with bank details
  - Return success response with transaction ID

## Additional Testing Scenarios

### Test Invalid Bank Account
```bash
curl -X POST http://localhost:3000/api/v1/wallet/bank/resolve \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "0000000000",
    "bankCode": "044"
  }'
```
Expected: Error from Paystack about invalid account

### Test Non-existent Bank Account for Withdrawal
```bash
curl -X POST http://localhost:3000/api/v1/wallet/withdraw \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "bankAccountId": "non-existent-id"
  }'
```
Expected: 404 Not Found - "Bank account not found"

### Test Bank Account Belonging to Another User
```bash
# Use a bankAccountId from a different user
curl -X POST http://localhost:3000/api/v1/wallet/withdraw \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "bankAccountId": "another-users-bank-id"
  }'
```
Expected: 400 Bad Request - "Bank account does not belong to user"
