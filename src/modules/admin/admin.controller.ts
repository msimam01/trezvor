import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('vault-balances')
  async getVaultBalances() {
    return this.adminService.getVaultBalances();
  }

  @Get('orders')
  async getOrders(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('chain') chain?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getOrders({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 10,
      status,
      chain,
      search,
    });
  }

  @Get('notifications')
  async getNotifications(@Query('unread') unread?: string) {
    return this.adminService.getNotifications(unread === 'true');
  }

  @Patch('notifications/:id/read')
  async markNotificationRead(@Param('id') id: string) {
    return this.adminService.markNotificationRead(id);
  }

  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 10,
      status,
      search,
    });
  }

  @Patch('users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body('status') status: 'active' | 'suspended' | 'banned',
  ) {
    return this.adminService.updateUserStatus(id, status);
  }

  @Get('settings')
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Post('settings')
  async updateSettings(@Body() settings: any) {
    return this.adminService.updateSettings(settings);
  }

  @Post('orders/:id/retry')
  async retryOrder(@Param('id') id: string) {
    return this.adminService.retryOrder(id);
  }

  @Patch('orders/:id/resolve')
  async resolveOrder(@Param('id') id: string, @Body('notes') notes?: string) {
    return this.adminService.resolveOrder(id, notes);
  }

  @Patch('orders/:id/refund')
  async refundOrder(@Param('id') id: string) {
    return this.adminService.refundOrder(id);
  }

  @Get('offramp')
  async getOfframpRequests(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getOfframpRequests({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 10,
      status,
    });
  }

  @Patch('offramp/:id/approve')
  async approveOfframp(@Param('id') id: string) {
    return this.adminService.approveOfframp(id);
  }

  @Patch('offramp/:id/reject')
  async rejectOfframp(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.adminService.rejectOfframp(id, reason);
  }

  @Get('affiliates')
  async getAffiliatePayouts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.getAffiliatePayouts({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 10,
    });
  }

  @Patch('affiliates/:id/approve')
  async approveAffiliatePayout(@Param('id') id: string) {
    return this.adminService.approveAffiliatePayout(id);
  }

  @Get('refunds')
  async getRefundRequests(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getRefundRequests({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 10,
      status,
    });
  }

  @Patch('refunds/:id/approve')
  async approveRefundRequest(@Param('id') id: string, @Body('adminNotes') adminNotes?: string) {
    return this.adminService.approveRefundRequest(id, adminNotes);
  }

  @Patch('refunds/:id/reject')
  async rejectRefundRequest(@Param('id') id: string, @Body('adminNotes') adminNotes?: string) {
    return this.adminService.rejectRefundRequest(id, adminNotes);
  }
}