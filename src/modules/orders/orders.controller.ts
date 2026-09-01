import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('my-orders')
  async getMyOrders(@Request() req: any) {
    // The user ID is extracted from the JWT token by the guard
    const userId = req.user.sub;
    return this.ordersService.getUserOrders(userId);
  }
}
