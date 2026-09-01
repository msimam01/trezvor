import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from './wallet.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';

describe('WalletService', () => {
  let service: WalletService;
  let httpService: HttpService;
  let prismaService: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    savedBank: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    walletTransaction: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'PAYSTACK_SECRET_KEY') return 'test_secret_key';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    httpService = module.get<HttpService>(HttpService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBanks', () => {
    it('should fetch banks from Paystack', async () => {
      const mockBanks = [
        { name: 'Access Bank', code: '044', active: true },
        { name: 'GTBank', code: '058', active: true },
      ];

      mockHttpService.get.mockReturnValue(of({
        data: { status: true, message: 'Banks retrieved', data: mockBanks },
      }));

      const result = await service.getBanks();

      expect(result).toEqual(mockBanks);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.paystack.co/bank?country=nigeria&perPage=100',
        {
          headers: { Authorization: 'Bearer test_secret_key' },
        },
      );
    });
  });

  describe('resolveAndSaveBank', () => {
    it('should resolve account and create new bank record', async () => {
      const userId = 'user-123';
      const accountNumber = '1234567890';
      const bankCode = '044';

      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            status: true,
            message: 'Account resolved',
            data: { account_number: accountNumber, account_name: 'John Doe', bank_id: 1 },
          },
        }),
      );

      mockHttpService.get.mockReturnValueOnce(
        of({
          data: { status: true, message: 'Banks retrieved', data: [{ name: 'Access Bank', code: '044' }] },
        }),
      );

      mockHttpService.post.mockReturnValue(
        of({
          data: {
            status: true,
            message: 'Recipient created',
            data: { recipient_code: 'RCP_123456' },
          },
        }),
      );

      mockPrismaService.savedBank.findFirst.mockResolvedValue(null);
      mockPrismaService.savedBank.create.mockResolvedValue({
        id: 'bank-123',
        userId,
        bankCode,
        bankName: 'Access Bank',
        accountNumber,
        accountName: 'John Doe',
        paystackRecipientCode: 'RCP_123456',
        isVerified: true,
      });

      const result = await service.resolveAndSaveBank(userId, accountNumber, bankCode);

      expect(result).toEqual({
        accountName: 'John Doe',
        bankName: 'Access Bank',
        paystackRecipientCode: 'RCP_123456',
      });

      expect(mockPrismaService.savedBank.create).toHaveBeenCalledWith({
        data: {
          userId,
          bankCode,
          bankName: 'Access Bank',
          accountNumber,
          accountName: 'John Doe',
          paystackRecipientCode: 'RCP_123456',
          isVerified: true,
        },
      });
    });

    it('should update existing bank record', async () => {
      const userId = 'user-123';
      const accountNumber = '1234567890';
      const bankCode = '044';

      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            status: true,
            message: 'Account resolved',
            data: { account_number: accountNumber, account_name: 'John Doe', bank_id: 1 },
          },
        }),
      );

      mockHttpService.get.mockReturnValueOnce(
        of({
          data: { status: true, message: 'Banks retrieved', data: [{ name: 'Access Bank', code: '044' }] },
        }),
      );

      mockHttpService.post.mockReturnValue(
        of({
          data: {
            status: true,
            message: 'Recipient created',
            data: { recipient_code: 'RCP_NEW_CODE' },
          },
        }),
      );

      mockPrismaService.savedBank.findFirst.mockResolvedValue({
        id: 'bank-123',
        userId,
        bankCode,
        bankName: 'Access Bank',
        accountNumber,
        accountName: 'Old Name',
        paystackRecipientCode: 'RCP_OLD_CODE',
        isVerified: false,
      });

      mockPrismaService.savedBank.update.mockResolvedValue({
        id: 'bank-123',
        userId,
        bankCode,
        bankName: 'Access Bank',
        accountNumber,
        accountName: 'John Doe',
        paystackRecipientCode: 'RCP_NEW_CODE',
        isVerified: true,
      });

      const result = await service.resolveAndSaveBank(userId, accountNumber, bankCode);

      expect(result).toEqual({
        accountName: 'John Doe',
        bankName: 'Access Bank',
        paystackRecipientCode: 'RCP_NEW_CODE',
      });

      expect(mockPrismaService.savedBank.update).toHaveBeenCalled();
    });
  });

  describe('getWalletBalance', () => {
    it('should return user balance and saved banks', async () => {
      const userId = 'user-123';

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        nairaBalance: 5000.0,
        savedBanks: [
          {
            id: 'bank-123',
            bankName: 'Access Bank',
            accountNumber: '1234567890',
            accountName: 'John Doe',
            isVerified: true,
          },
        ],
      });

      const result = await service.getWalletBalance(userId);

      expect(result).toEqual({
        nairaBalance: 5000.0,
        savedBanks: [
          {
            id: 'bank-123',
            bankName: 'Access Bank',
            accountNumber: '1234567890',
            accountName: 'John Doe',
            isVerified: true,
          },
        ],
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getWalletBalance('non-existent-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('withdraw', () => {
    it('should reject withdrawal if amount <= 0', async () => {
      await expect(service.withdraw('user-123', 0, 'bank-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject withdrawal if insufficient balance', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        nairaBalance: 500.0,
      });

      await expect(service.withdraw('user-123', 1000, 'bank-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject withdrawal if bank account not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        nairaBalance: 5000.0,
      });

      mockPrismaService.savedBank.findUnique.mockResolvedValue(null);

      await expect(service.withdraw('user-123', 1000, 'bank-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject withdrawal if bank account belongs to another user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        nairaBalance: 5000.0,
      });

      mockPrismaService.savedBank.findUnique.mockResolvedValue({
        id: 'bank-123',
        userId: 'user-456', // Different user
        paystackRecipientCode: 'RCP_123456',
      });

      await expect(service.withdraw('user-123', 1000, 'bank-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should process successful withdrawal', async () => {
      const userId = 'user-123';
      const amount = 1000;
      const bankAccountId = 'bank-123';

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        nairaBalance: 5000.0,
      });

      mockPrismaService.savedBank.findUnique.mockResolvedValue({
        id: bankAccountId,
        userId,
        bankName: 'Access Bank',
        accountNumber: '1234567890',
        paystackRecipientCode: 'RCP_123456',
      });

      mockPrismaService.walletTransaction.create.mockResolvedValue({
        id: 'txn-123',
        userId,
        amount,
        type: 'WITHDRAWAL',
        status: 'PENDING',
        reference: 'WD_user-123_1234567890',
      });

      mockHttpService.post.mockReturnValue(
        of({
          data: {
            status: true,
            message: 'Transfer successful',
            data: {
              transfer_code: 'TRF_123456',
              status: 'success',
            },
          },
        }),
      );

      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.walletTransaction.update.mockResolvedValue({});

      const result = await service.withdraw(userId, amount, bankAccountId);

      expect(result).toEqual({
        success: true,
        message: 'Withdrawal processed successfully',
        transactionId: 'txn-123',
        reference: expect.stringContaining('WD_'),
      });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { nairaBalance: { decrement: amount } },
      });

      expect(mockPrismaService.walletTransaction.update).toHaveBeenCalledWith({
        where: { id: 'txn-123' },
        data: {
          status: 'SUCCESS',
          metadata: expect.objectContaining({
            transferCode: 'TRF_123456',
            transferStatus: 'success',
          }),
        },
      });
    });
  });

  describe('addFunds', () => {
    it('should add funds to user balance and create transaction', async () => {
      const userId = 'user-123';
      const amount = 500;
      const type = 'REFERRAL_EARNING';
      const reference = 'REF_123456';

      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.walletTransaction.create.mockResolvedValue({});

      await service.addFunds(userId, amount, type, reference);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { nairaBalance: { increment: amount } },
      });

      expect(mockPrismaService.walletTransaction.create).toHaveBeenCalledWith({
        data: {
          userId,
          amount,
          type,
          status: 'SUCCESS',
          reference,
          metadata: undefined,
        },
      });
    });
  });
});
