import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.log(`AdminGuard check - User: ${JSON.stringify(user)}`);

    if (!user) {
      throw new ForbiddenException('Access denied - No user found');
    }

    // Check if user has admin role
    if (!user.isAdmin && user.role !== 'admin') {
      this.logger.warn(`Admin access denied for user: ${user.id}`);
      throw new ForbiddenException('Admin access required');
    }

    this.logger.log(`Admin access granted for user: ${user.id}`);
    return true;
  }
}