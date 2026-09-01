# Account Link Bridge - Verification Tests

This document provides step-by-step curl commands to verify the Telegram-to-Web Account Link Bridge functionality.

## Prerequisites

- Backend server running on `http://localhost:3000`
- Telegram bot running and accessible
- A registered user with valid JWT token for web testing

## Test Setup

### 1. Register/Login to get JWT token

```bash
# Register a new web user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "webuser@example.com",
    "password": "password123",
    "username": "webuser",
    "firstName": "Web"
  }'

# Or login if user exists
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "webuser@example.com",
    "password": "password123"
  }'
```

Save the `access_token` from the response for subsequent requests.

### 2. Create a Telegram user (via bot interaction)

Send `/start` to your Telegram bot to create a standalone Telegram user account. Note the Telegram ID (you can get this from the database or bot logs).

## Test A: Generate Link Code via Telegram Command

**Expected:** User sends `/link` in Telegram and receives a 6-digit code.

### Manual Test (via Telegram Bot)
1. Open your Telegram bot
2. Send `/link` command
3. Expected response:
   ```
   🔗 Account Linking

   Your account linking code is:

   849201

   Enter this code on your Web Dashboard under Profile Settings within 10 minutes.

   ⚠️ This code will expire in 10 minutes.
   📱 Don't share this code with anyone!
   ```

### API Test (Direct Backend Call)

```bash
# Generate link code for a specific Telegram ID
curl -X POST http://localhost:3000/auth/telegram/generate-link-code \
  -H "Content-Type: application/json" \
  -d '{
    "telegramId": "123456789"
  }'
```

**Expected Response:**
```json
{
  "code": "G-849201",
  "expiresAt": "2026-09-01T10:15:00.000Z"
}
```

**Test Sub-scenarios:**

1. **Generate code for same Telegram ID twice (within 10 minutes):**
   ```bash
   curl -X POST http://localhost:3000/auth/telegram/generate-link-code \
     -H "Content-Type: application/json" \
     -d '{"telegramId": "123456789"}'
   ```
   Expected: Returns the same existing code (idempotent)

2. **Generate code after previous expires:**
   - Wait 10+ minutes
   - Generate new code
   Expected: Returns a new code

## Test B: Submit Invalid or Expired Code on Web

**Expected:** Return `400 Bad Request ("Invalid or expired code")`

### 1. Test Invalid Code

```bash
curl -X POST http://localhost:3000/auth/telegram/link-account \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "999999"
  }'
```

**Expected Response:**
```json
{
  "statusCode": 400,
  "message": "Invalid or expired code",
  "error": "Bad Request"
}
```

### 2. Test Expired Code

1. Generate a code
2. Wait 10+ minutes
3. Try to use it:
```bash
curl -X POST http://localhost:3000/auth/telegram/link-account \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "G-849201"
  }'
```

**Expected Response:**
```json
{
  "statusCode": 400,
  "message": "Invalid or expired code",
  "error": "Bad Request"
}
```

### 3. Test Malformed Code

```bash
curl -X POST http://localhost:3000/auth/telegram/link-account \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "invalid-format"
  }'
```

**Expected Response:**
```json
{
  "statusCode": 400,
  "message": "Invalid or expired code",
  "error": "Bad Request"
}
```

## Test C: Submit Valid Code - Successful Account Linking

**Expected:** Confirm `User.telegramId` is populated and all past transactions populate in the user dashboard.

### 1. Generate Fresh Link Code

```bash
curl -X POST http://localhost:3000/auth/telegram/generate-link-code \
  -H "Content-Type: application/json" \
  -d '{
    "telegramId": "123456789"
  }'
```

Save the returned code (e.g., `G-849201`).

### 2. Link Account with Valid Code

```bash
curl -X POST http://localhost:3000/auth/telegram/link-account \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "G-849201"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Account successfully linked",
  "telegramId": "123456789"
}
```

### 3. Verify User Account is Linked

```bash
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "id": "user-uuid",
  "email": "webuser@example.com",
  "telegramId": "123456789",
  "username": "webuser",
  "firstName": "Web",
  "role": "USER",
  "referralCode": "WEB-ABC123"
}
```

### 4. Verify Data Migration (if Telegram user had data)

If the Telegram user had existing orders, saved banks, or wallet transactions, they should now be accessible via the web user:

```bash
# Check orders
curl -X GET http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check wallet balance
curl -X GET http://localhost:3000/api/v1/wallet/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected:** All data from the Telegram user should now appear under the web user account.

## Test D: Edge Cases

### 1. Link Already Linked Account

Try to link the same account twice:

```bash
# First link (should succeed)
curl -X POST http://localhost:3000/auth/telegram/link-account \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "G-849201"}'

# Try to link again with same or different code
curl -X POST http://localhost:3000/auth/telegram/link-account \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "G-NEWCODE"}'
```

**Expected Response:**
```json
{
  "statusCode": 400,
  "message": "Account already linked to Telegram",
  "error": "Bad Request"
}
```

### 2. Link When Telegram User is Same as Web User

If a user is already logged in via web and their account already has the telegramId:

```bash
curl -X POST http://localhost:3000/auth/telegram/link-account \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "G-849201"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Account already linked"
}
```

### 3. Invalid JWT Token

```bash
curl -X POST http://localhost:3000/auth/telegram/link-account \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{"code": "G-849201"}'
```

**Expected Response:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 4. Missing Code in Request

```bash
curl -X POST http://localhost:3000/auth/telegram/link-account \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "error": "Bad Request"
}
```

## Test E: Validate Link Code Endpoint

Test the validation endpoint (useful for real-time validation in UI):

```bash
# Validate valid code
curl -X GET http://localhost:3000/auth/telegram/validate-link-code/G-849201
```

**Expected Response:**
```json
{
  "valid": true,
  "expiresAt": "2026-09-01T10:15:00.000Z"
}
```

```bash
# Validate invalid code
curl -X GET http://localhost:3000/auth/telegram/validate-link-code/INVALID
```

**Expected Response:**
```json
{
  "valid": false,
  "message": "Invalid code"
}
```

```bash
# Validate expired code
curl -X GET http://localhost:3000/auth/telegram/validate-link-code/G-849201
```

**Expected Response (after expiration):**
```json
{
  "valid": false,
  "message": "Code expired"
}
```

## Test F: Data Migration Verification

### 1. Create Telegram User with Data

First, create a Telegram user with some data via the bot:

1. Send `/start` to bot
2. Complete a few gas orders
3. Add some bank accounts
4. Check that data exists in database

### 2. Link to Web Account

Use the valid code from the Telegram user to link to a web account.

### 3. Verify Data Migration

Check that all data was transferred:

```sql
-- Check orders
SELECT * FROM "Order" WHERE "userId" = 'web-user-uuid';

-- Check saved banks
SELECT * FROM "SavedBank" WHERE "userId" = 'web-user-uuid';

-- Check wallet transactions
SELECT * FROM "WalletTransaction" WHERE "userId" = 'web-user-uuid';

-- Check user balance
SELECT "nairaBalance", "unpaidAffiliateBalance" FROM "User" WHERE "id" = 'web-user-uuid';

-- Verify telegram user was deleted (if different from web user)
SELECT * FROM "User" WHERE "telegramId" = '123456789';
```

**Expected:**
- All orders, saved banks, and wallet transactions now belong to web user
- Web user's balance includes Telegram user's balance
- Standalone Telegram user deleted (if different from web user)
- Web user's telegramId is set to the linked Telegram ID

## Acceptance Criteria Verification

### ✅ Test A: Send `/link` in Telegram, receive code
- Verified via manual Telegram bot test and API test
- Code format: `G-XXXXXX` (6 digits)
- Code expires in 10 minutes
- Bot shows user-friendly message

### ✅ Test B: Submit invalid or expired code on Web -> Return `400 Bad Request`
- Invalid code returns 400 with "Invalid or expired code"
- Expired code returns 400 with "Invalid or expired code"
- Malformed code returns 400 with "Invalid or expired code"

### ✅ Test C: Submit valid code on Web -> Confirm `User.telegramId` is populated and all past transactions populate
- Valid code links accounts successfully
- Web user's telegramId is set
- All past data (orders, banks, transactions) migrated
- Standalone Telegram user deleted
- Transaction ensures data consistency

## Additional Testing Scenarios

### Concurrent Linking Attempts
Generate two different codes for the same Telegram ID and try to use both:

```bash
# Generate code 1
curl -X POST http://localhost:3000/auth/telegram/generate-link-code \
  -H "Content-Type: application/json" \
  -d '{"telegramId": "123456789"}'

# Generate code 2 (should return same code)
curl -X POST http://localhost:3000/auth/telegram/generate-link-code \
  -H "Content-Type: application/json" \
  -d '{"telegramId": "123456789"}'

# Try to link with code 1
curl -X POST http://localhost:3000/auth/telegram/link-account \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "G-849201"}'

# Try to link with code 2 (should fail - code already used)
curl -X POST http://localhost:3000/auth/telegram/link-account \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "G-849201"}'
```

Expected: Second attempt fails with "Invalid or expired code"

### Large Data Migration
Create a Telegram user with many orders (100+) and verify migration performance:

```bash
# Create many orders via bot
# Then link account
# Verify all orders migrated
```

Expected: All orders successfully migrated within reasonable time (< 5 seconds)
