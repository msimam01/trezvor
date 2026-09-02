import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000/api/v1';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
});

// Request interceptor to add auth token if available
apiClient.interceptors.request.use(
  (config) => {
    // Try admin token first, then user token
    const adminToken = localStorage.getItem('admin_token');
    const userToken = localStorage.getItem('auth_token');
    const token = adminToken || userToken;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      const isAdmin = window.location.pathname.startsWith('/admin');
      const tokenKey = isAdmin ? 'admin_token' : 'auth_token';
      localStorage.removeItem(tokenKey);
      
      // Redirect to appropriate login page
      if (isAdmin) {
        window.location.href = '/admin';
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Types for API responses
export interface VaultBalance {
  chain: 'SOLANA' | 'BASE' | 'TON';
  symbol: string;
  balance: number | string;
  address: string;
  status: 'healthy' | 'warning' | 'critical';
}

export interface Order {
  id: string;
  userId: string;
  user: {
    id: string;
    telegramId?: bigint;
    username?: string;
    firstName?: string;
  };
  chain: 'SOLANA' | 'BASE' | 'TON';
  targetWallet: string;
  fiatAmountNaira: number | string;
  feeNaira: number | string;
  totalAmount: number | string;
  cryptoAmount: number | string;
  paymentRef: string;
  paymentGateway: 'PAYSTACK' | 'FLUTTERWAVE' | 'OPAY';
  txHash?: string;
  status: 'PENDING_PAYMENT' | 'PAYMENT_VERIFIED' | 'DISPENSING_QUEUED' | 'PENDING_LIQUIDITY' | 'DISPENSED_SUCCESS' | 'FAILED_REFUND_NEEDED' | 'REFUNDED';
  createdAt: string;
  updatedAt: string;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: string;
  telegramId?: bigint;
  username?: string;
  firstName?: string;
  status: 'active' | 'suspended' | 'banned';
  totalOrders: number;
  lifetimeVolume: number;
  joinedDate: string;
  lastActive: string;
}

export interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Notification {
  id: string;
  type: 'low-liquidity' | 'failed-transaction' | 'user-dispute' | 'system-alert';
  title: string;
  message: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  read: boolean;
  metadata?: Record<string, any>;
}

export interface FeeSettings {
  platformFeePercentage: number;
  maxFeeCap: number;
  referralCommissionRate: number;
  isVirtualAccountEnabled: boolean;
}

export interface LiquidityThreshold {
  chain: 'SOLANA' | 'BASE' | 'TON';
  symbol: string;
  minBalance: number;
  alertThreshold: number;
}

export interface PlatformSettings {
  feeSettings: FeeSettings;
  liquidityThresholds: {
    SOLANA: { minBalance: number; alertThreshold: number };
    BASE: { minBalance: number; alertThreshold: number };
    TON: { minBalance: number; alertThreshold: number };
  };
}

// API Functions
export const api = {
  // Authentication
  adminLogin: async (secret: string): Promise<{ access_token: string; user: any }> => {
    const response = await apiClient.post('/auth/admin/login', { secret });
    return response.data;
  },

  telegramLogin: async (telegramData: any): Promise<{ access_token: string; user: any }> => {
    const response = await apiClient.post('/auth/telegram', telegramData);
    return response.data;
  },

  // Vault Balances
  getVaultBalances: async (): Promise<VaultBalance[]> => {
    const response = await apiClient.get('/admin/vault-balances');
    return response.data;
  },

  // Orders Management
  getOrders: async (params?: {
    status?: string;
    chain?: string;
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<OrdersResponse> => {
    const response = await apiClient.get('/admin/orders', { params });
    return response.data;
  },

  retryOrder: async (orderId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(`/admin/orders/${orderId}/retry`);
    return response.data;
  },

  markOrderResolved: async (orderId: string, notes?: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.patch(`/admin/orders/${orderId}/resolve`, { notes });
    return response.data;
  },

  refundOrder: async (orderId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.patch(`/admin/orders/${orderId}/refund`);
    return response.data;
  },

  // User Management
  getUsers: async (params?: {
    status?: string;
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<UsersResponse> => {
    const response = await apiClient.get('/admin/users', { params });
    return response.data;
  },

  updateUserStatus: async (userId: string, status: 'active' | 'suspended' | 'banned'): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.patch(`/admin/users/${userId}/status`, { status });
    return response.data;
  },

  // Notifications
  getNotifications: async (params?: {
    urgency?: string;
    read?: boolean;
  }): Promise<{ notifications: Notification[]; total: number }> => {
    const response = await apiClient.get('/admin/notifications', { params });
    return response.data;
  },

  markNotificationRead: async (notificationId: string): Promise<{ success: boolean }> => {
    const response = await apiClient.patch(`/admin/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllNotificationsRead: async (): Promise<{ success: boolean }> => {
    const response = await apiClient.post('/admin/notifications/mark-all-read');
    return response.data;
  },

  // Platform Settings
  getSettings: async (): Promise<PlatformSettings> => {
    const response = await apiClient.get('/admin/settings');
    return response.data;
  },

  updateSettings: async (settings: PlatformSettings): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.patch('/admin/settings', settings);
    return response.data;
  },

  // User Endpoints
  getMyOrders: async (): Promise<Order[]> => {
    const response = await apiClient.get('/orders/my-orders');
    return response.data;
  },

  // Auth Endpoints
  register: async (data: { email: string; password: string; username?: string; firstName?: string }): Promise<{
    access_token: string;
    user: {
      id: string;
      email: string;
      username: string;
      firstName: string;
      role: string;
      referralCode: string;
    };
  }> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  login: async (email: string, password: string): Promise<{
    access_token: string;
    user: {
      id: string;
      email: string;
      username: string;
      firstName: string;
      role: string;
      referralCode: string;
    };
  }> => {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  },

  telegramAuth: async (data: { telegramId: string; username?: string; firstName?: string; authDate: number; hash: string }): Promise<{
    access_token: string;
    user: {
      id: string;
      telegramId: string;
      username: string;
      firstName: string;
      role: string;
      referralCode: string;
    };
  }> => {
    const response = await apiClient.post('/auth/telegram', data);
    return response.data;
  },

  getReferralInfo: async (): Promise<{
    referralCode: string;
    referralLink: string;
    referralCount: number;
    unpaidEarnings: number;
  }> => {
    const response = await apiClient.get('/user/referral');
    return response.data;
  },

  getReferralStats: async (): Promise<{
    referralCode: string;
    referralLink: string;
    totalReferred: number;
    pendingBonuses: number;
    totalPaidBonuses: number;
    unpaidBalance: number;
  }> => {
    const response = await apiClient.get('/referrals/stats');
    return response.data.data;
  },

  requestPayout: async (bankDetails: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
  }): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/user/referral/payout', bankDetails);
    return response.data;
  },

  submitOfframp: async (offrampData: {
    token: string;
    amount: number;
    bybitUid: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
  }): Promise<{ success: boolean; message: string; requestId: string }> => {
    const response = await apiClient.post('/user/offramp/bybit', offrampData);
    return response.data;
  },

  submitRefundRequest: async (orderId: string, reason: string): Promise<{ success: boolean; message: string; requestId: string }> => {
    const response = await apiClient.post(`/orders/${orderId}/refund-request`, { reason });
    return response.data;
  },

  // Admin Offramp Endpoints
  getAdminOfframpRequests: async (params?: { status?: string }): Promise<{
    requests: any[];
  }> => {
    const response = await apiClient.get('/admin/offramp/pending', { params });
    return response.data;
  },

  approveOfframp: async (requestId: string): Promise<any> => {
    const response = await apiClient.patch(`/admin/offramp/${requestId}/approve`);
    return response.data;
  },

  rejectOfframp: async (requestId: string, reason?: string): Promise<any> => {
    const response = await apiClient.patch(`/admin/offramp/${requestId}/reject`, { reason });
    return response.data;
  },

  // Admin Affiliate Endpoints
  getAdminAffiliatePayouts: async (params?: { page?: number; pageSize?: number }): Promise<{
    users: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const response = await apiClient.get('/admin/affiliates', { params });
    return response.data;
  },

  approveAffiliatePayout: async (userId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.patch(`/admin/affiliates/${userId}/approve`);
    return response.data;
  },

  // Admin Refund Request Endpoints
  getAdminRefundRequests: async (params?: { page?: number; pageSize?: number; status?: string }): Promise<{
    requests: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const response = await apiClient.get('/admin/refunds', { params });
    return response.data;
  },

  approveRefundRequest: async (requestId: string, adminNotes?: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.patch(`/admin/refunds/${requestId}/approve`, { adminNotes });
    return response.data;
  },

  rejectRefundRequest: async (requestId: string, adminNotes?: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.patch(`/admin/refunds/${requestId}/reject`, { adminNotes });
    return response.data;
  },

  // Public Endpoints
  getLiveRates: async (): Promise<{
    SOLANA: { rate: number; symbol: string };
    BASE: { rate: number; symbol: string };
    TON: { rate: number; symbol: string };
  }> => {
    const response = await apiClient.get('/rates');
    return response.data;
  },

  // Account Linking Endpoints
  linkTelegramAccount: async (code: string): Promise<{ success: boolean; message: string; telegramId?: string }> => {
    const response = await apiClient.post('/auth/telegram/link-account', { code });
    return response.data;
  },

  validateLinkCode: async (code: string): Promise<{ valid: boolean; message?: string; expiresAt?: string }> => {
    const response = await apiClient.get(`/auth/telegram/validate-link-code/${code}`);
    return response.data;
  },

  generateLinkCode: async (telegramId: string): Promise<{ code: string; expiresAt: string }> => {
    const response = await apiClient.post('/auth/telegram/generate-link-code', { telegramId });
    return response.data;
  },

  // User Profile Endpoints
  getUserProfile: async (): Promise<{
    id: string;
    email: string;
    username?: string;
    firstName?: string;
    telegramId?: string;
    role: string;
    referralCode: string;
    status: string;
  }> => {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  },
};

export default apiClient;