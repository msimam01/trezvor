import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { OfframpService } from './offramp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { 
  CreateOfframpRequestDto, 
  ApproveOfframpRequestDto, 
  RejectOfframpRequestDto,
  OfframpRequestResponse,
  AdminOfframpQueueResponse 
} from './offramp.dto';

interface RequestWithUser extends Request {
  user: {
    sub: string;
    email?: string;
    role?: string;
    isAdmin?: boolean;
  };
}

@Controller('offramp')
export class OfframpController {
  constructor(private readonly offrampService: OfframpService) {}

  /**
   * Submit off-ramp request (protected for web, public for bot via userId)
   */
  @Post('submit')
  @UseGuards(JwtAuthGuard)
  async submitOfframpRequest(
    @Request() req: RequestWithUser,
    @Body() dto: CreateOfframpRequestDto,
  ): Promise<OfframpRequestResponse> {
    const userId = req.user.sub;
    return this.offrampService.createOfframpRequest(userId, dto);
  }

  /**
   * Public endpoint for bot to submit requests (bot will provide userId directly)
   */
  @Post('bot-submit')
  async botSubmitOfframpRequest(
    @Body() body: { userId: string } & CreateOfframpRequestDto,
  ): Promise<OfframpRequestResponse> {
    const { userId, ...dto } = body;
    return this.offrampService.createOfframpRequest(userId, dto);
  }

  /**
   * Get user's off-ramp request history
   */
  @Get('my-requests')
  @UseGuards(JwtAuthGuard)
  async getMyRequests(@Request() req: RequestWithUser): Promise<OfframpRequestResponse[]> {
    const userId = req.user.sub;
    return this.offrampService.getUserOfframpRequests(userId);
  }
}

@Controller('admin/offramp')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminOfframpController {
  constructor(private readonly offrampService: OfframpService) {}

  /**
   * Get pending off-ramp requests for admin review
   */
  @Get('pending')
  async getPendingRequests(@Query('status') status?: string): Promise<AdminOfframpQueueResponse> {
    // If status is provided, we'll need to add a method to get by status
    // For now, just return pending requests
    const requests = await this.offrampService.getPendingOfframpRequests();
    return { requests };
  }

  /**
   * Approve an off-ramp request and trigger payout
   */
  @Patch(':id/approve')
  async approveRequest(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ): Promise<OfframpRequestResponse> {
    const adminId = req.user.sub;
    return this.offrampService.approveOfframpRequest(id, adminId);
  }

  /**
   * Reject an off-ramp request
   */
  @Patch(':id/reject')
  async rejectRequest(
    @Param('id') id: string,
    @Body() dto: RejectOfframpRequestDto,
  ): Promise<OfframpRequestResponse> {
    return this.offrampService.rejectOfframpRequest(id, dto.reason);
  }
}