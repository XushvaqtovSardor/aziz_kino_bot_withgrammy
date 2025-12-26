import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { SessionService } from './services/session.service';
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AdminService, SessionService, AdminGuard, RolesGuard],
  exports: [AdminService, SessionService, AdminGuard, RolesGuard],
})
export class AdminModule {}
