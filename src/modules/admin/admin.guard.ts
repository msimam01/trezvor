import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    // In production, check if user has admin role
    // For now, we'll check if the user has an admin flag or role
    if (!user.isAdmin && user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}