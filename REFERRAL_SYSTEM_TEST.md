# Referral & First-Deposit Bonus System - Test Plan

## Implementation Summary

### ✅ Completed Components

1. **Database Schema**
   - Added `hasCompletedFirstDeposit` field to User model
   - Added `ReferralRecord` model with tracking for referrals
   - Added relations between User and ReferralRecord

2. **Backend Module (`src/modules/referrals`)**
   - `ReferralService` with bonus processing logic
   - `ReferralController` with protected and public endpoints
   - Integration with payment webhook for automatic bonus processing

3. **Telegram Bot Integration**
   - `/ref` command to display referral stats
   - Deep linking support in `/start` command for referral codes
   - Automatic referral record creation on user registration

4. **Web UI**
   - Referral dashboard at `/dashboard/referrals`
   - Display of referral link, code, and stats
   - Payout request functionality

5. **Environment Configuration**
   - Added `TELEGRAM_BOT_USERNAME` and `REFERRAL_BONUS_AMOUNT` to env variables

## Test Acceptance Criteria

### Test A: User Registration with Referral Code
**Goal:** Register User B using User A's `/start REF_CODE` link. Confirm `referredById` is set on User B.

**Steps:**
1. Get User A's referral code via `/ref` command or web dashboard
2. Generate deep link: `https://t.me/GasBot?start=<REF_CODE>`
3. Register User B using this link
4. Check database to confirm `referredById` is set correctly

**Expected Result:**
- User B has `referredById` set to User A's ID
- `ReferralRecord` created with status `PENDING`
- User B's `hasCompletedFirstDeposit` is `false`

### Test B: First Deposit Bonus Processing
**Goal:** Simulate User B's first deposit/purchase. Confirm `hasCompletedFirstDeposit` switches to `true` and User A's `nairaBalance` increases by ₦200.

**Steps:**
1. User B makes first gas purchase through the bot
2. Payment webhook triggers `processFirstDepositBonus`
3. Check User B's `hasCompletedFirstDeposit` status
4. Check User A's `unpaidAffiliateBalance` increase
5. Verify `WalletTransaction` record created

**Expected Result:**
- User B's `hasCompletedFirstDeposit` = `true`
- User A's `unpaidAffiliateBalance` increased by ₦200
- `ReferralRecord` status changed to `REWARDED`
- `WalletTransaction` created with type `REFERRAL_EARNING`

### Test C: Second Deposit (No Duplicate Bonus)
**Goal:** Simulate User B's second deposit. Confirm no additional ₦200 bonus is issued.

**Steps:**
1. User B makes another gas purchase
2. Verify that no additional bonus is processed
3. Check that User A's balance doesn't increase again

**Expected Result:**
- No additional bonus is issued
- `hasCompletedFirstDeposit` remains `true`
- User A's balance unchanged

### Test D: Stats Display Verification
**Goal:** Confirm User A can view updated stats on both Telegram (`/ref`) and Web (`/dashboard/referrals`).

**Steps:**
1. User A sends `/ref` command in Telegram
2. User A visits `/dashboard/referrals` in web UI
3. Verify stats match between both platforms
4. Check referral link and code display

**Expected Result:**
- Both platforms show same referral code and link
- Total referred count matches
- Bonus amounts are correctly displayed
- Unpaid balance is accurate

## Manual Testing Steps

### 1. Start the Backend Server
```bash
npm run start:dev
```

### 2. Test Telegram Bot Registration
1. Open your Telegram bot
2. Send `/ref` to get your referral code
3. Copy the referral code
4. Generate deep link: `https://t.me/GasBot?start=<YOUR_CODE>`
5. Use this link in a different Telegram account to register

### 3. Test Bonus Processing
1. Make a gas purchase through the newly registered account
2. Monitor backend logs for bonus processing
3. Check database for updated balances and records

### 4. Test Web Dashboard
1. Login to web dashboard
2. Navigate to `/dashboard/referrals`
3. Verify stats display correctly
4. Test referral link copy functionality

## API Endpoints

### Protected Endpoints (JWT Auth Required)
- `GET /api/v1/referrals/stats` - Get user's referral stats
- `POST /api/v1/referrals/process-first-deposit` - Process first deposit bonus (internal)

### Public Endpoints
- `GET /api/v1/referrals/public/stats/:userId` - Get referral stats for Telegram bot

## Database Tables

### User Model (Updated)
- `hasCompletedFirstDeposit` (Boolean) - Tracks if user completed first deposit
- `referredById` (String) - ID of user who referred this user
- Relations to `ReferralRecord` for tracking referrals

### ReferralRecord Model (New)
- `id` (String) - Primary key
- `referrerId` (String) - ID of the referrer
- `refereeId` (String) - ID of the referred user (unique)
- `bonusAmount` (Float) - Bonus amount (default ₦200)
- `status` (ReferralStatus) - PENDING or REWARDED
- `rewardedAt` (DateTime) - When bonus was rewarded
- `createdAt` (DateTime) - Record creation time

## Key Features

### Automatic Bonus Processing
- Triggered by Paystack webhook on successful payment
- Processes bonus in database transaction for consistency
- Creates immutable wallet transaction records
- Sends notification to referrer (logged, bot integration ready)

### Deep Linking Support
- Telegram deep links: `https://t.me/GasBot?start=REF_CODE`
- Automatic referral record creation on registration
- Handles both referral codes and order tracking links

### Stats Tracking
- Total referred users
- Pending bonuses (users registered but no first deposit yet)
- Total paid bonuses
- Unpaid balance (withdrawable earnings)

### Multi-Platform Access
- Telegram bot: `/ref` command
- Web dashboard: `/dashboard/referrals`
- Consistent data across platforms

## Troubleshooting

### Bonus Not Processing
1. Check if webhook is receiving payment events
2. Verify `hasCompletedFirstDeposit` is `false` for referee
3. Check if referral record exists and has `PENDING` status
4. Review backend logs for processing errors

### Referral Code Not Working
1. Verify referral code format in database
2. Check if referrer exists in database
3. Ensure `/start` command is receiving the payload correctly
4. Review bot logs for registration errors

### Stats Not Updating
1. Verify database relations are correct
2. Check if referral records are being created
3. Review API endpoint responses
4. Check web API authentication tokens

## Future Enhancements

1. **Bot Notification Integration** - Send Telegram notifications when bonuses are earned
2. **Multi-tier Referral System** - Support for multiple referral levels
3. **Bonus Configuration** - Dynamic bonus amounts based on user tiers
4. **Analytics Dashboard** - Admin view of referral performance
5. **Fraud Detection** - Detect and prevent referral abuse

## Environment Variables Required

```env
TELEGRAM_BOT_USERNAME=GasBot
REFERRAL_BONUS_AMOUNT=200
APP_BASE_URL=http://localhost:3000
```

## Success Criteria

✅ Database schema updated and migrated
✅ Referral module created and integrated
✅ Bonus processing logic implemented
✅ Telegram bot commands added
✅ Web dashboard UI created
✅ Deep linking support implemented
✅ Payment webhook integration completed
✅ Environment configuration updated

The referral system is now fully implemented and ready for testing!