import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AdminApiGuard } from './admin-api.guard';
import { AdminService } from '../admin/services/admin.service';
import { UserService } from '../user/services/user.service';
import { FieldService } from '../field/services/field.service';
import { ChannelService } from '../channel/services/channel.service';
import { MovieService } from '../content/services/movie.service';
import { SerialService } from '../content/services/serial.service';
import { PaymentService } from '../payment/services/payment.service';
import { AdminRole } from '@prisma/client';

@Controller('api/admin')
@UseGuards(AdminApiGuard)
export class AdminApiController {
  constructor(
    private adminService: AdminService,
    private userService: UserService,
    private fieldService: FieldService,
    private channelService: ChannelService,
    private movieService: MovieService,
    private serialService: SerialService,
    private paymentService: PaymentService,
  ) {}

  // ==================== AUTH ====================
  @Get('me')
  getMe(@Request() req: any) {
    return req.admin;
  }

  // ==================== STATISTICS ====================
  @Get('stats')
  async getStatistics() {
    const [userStats, paymentStats] = await Promise.all([
      this.userService.getUserStatistics(),
      this.paymentService.getStatistics(),
    ]);

    return {
      users: userStats,
      payments: paymentStats,
    };
  }

  // ==================== ADMINS ====================
  @Get('admins')
  async getAdmins(@Request() req) {
    const isSuperAdmin = req.admin.role === AdminRole.SUPERADMIN;
    if (!isSuperAdmin) {
      throw new HttpException(
        'Only SuperAdmin can view admins',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.adminService.findAll();
  }

  @Post('admins')
  async createAdmin(
    @Request() req,
    @Body() body: { telegramId: string; username: string; role: AdminRole },
  ) {
    const isSuperAdmin = req.admin.role === AdminRole.SUPERADMIN;
    if (!isSuperAdmin) {
      throw new HttpException(
        'Only SuperAdmin can create admins',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.adminService.createAdmin({
      telegramId: body.telegramId,
      username: body.username,
      role: body.role,
      createdBy: req.admin.telegramId,
    });
  }

  @Delete('admins/:telegramId')
  async deleteAdmin(@Request() req, @Param('telegramId') telegramId: string) {
    const isSuperAdmin = req.admin.role === AdminRole.SUPERADMIN;
    if (!isSuperAdmin) {
      throw new HttpException(
        'Only SuperAdmin can delete admins',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.adminService.deleteAdmin(telegramId);
  }

  // ==================== USERS ====================
  @Get('users')
  async getUsers() {
    return this.userService.getAllUsers();
  }

  @Get('users/:telegramId')
  async getUser(@Param('telegramId') telegramId: string) {
    return this.userService.findByTelegramId(telegramId);
  }

  @Put('users/:telegramId/block')
  async blockUser(
    @Param('telegramId') telegramId: string,
    @Body() body: { reason?: string },
  ) {
    return this.userService.blockUser(telegramId, body.reason);
  }

  @Put('users/:telegramId/unblock')
  async unblockUser(@Param('telegramId') telegramId: string) {
    return this.userService.unblockUser(telegramId);
  }

  // ==================== FIELDS ====================
  @Get('fields')
  async getFields() {
    return this.fieldService.findAll();
  }

  @Post('fields')
  async createField(@Body() body: { name: string; channelLink: string }) {
    const link = (body.channelLink || '').trim();

    let channelId: string | undefined;
    if (link.startsWith('@') || link.startsWith('-100')) {
      channelId = link;
    } else {
      const match = link.match(/(?:https?:\/\/)?t\.me\/([^/?#]+)/i);
      if (match?.[1]) {
        channelId = '@' + match[1];
      }
    }

    if (!channelId) {
      throw new BadRequestException(
        "Kanal linki noto'g'ri. Masalan: https://t.me/kanal_nomi yoki @kanal_nomi",
      );
    }

    return this.fieldService.create({
      name: body.name,
      channelId: channelId,
      channelLink: body.channelLink,
    });
  }

  @Delete('fields/:id')
  async deleteField(@Param('id') id: number) {
    return this.fieldService.delete(+id);
  }

  // ==================== CHANNELS ====================
  @Get('channels/mandatory')
  async getMandatoryChannels() {
    return this.channelService.findAll();
  }

  @Post('channels/mandatory')
  async createMandatoryChannel(
    @Body()
    body: {
      channelId?: string;
      channelName: string;
      channelLink: string;
      order?: number;
    },
  ) {
    // Extract channelId from link if not provided
    let channelId = body.channelId;
    if (!channelId && body.channelLink) {
      // Try to extract from t.me/username
      const match = body.channelLink.match(/t\.me\/([^/?]+)/);
      if (match) {
        channelId = '@' + match[1];
      } else {
        channelId = body.channelLink;
      }
    }

    return this.channelService.create(
      channelId,
      body.channelName,
      body.channelLink,
      body.order,
    );
  }

  @Delete('channels/mandatory/:id')
  async deleteMandatoryChannel(@Param('id') id: number) {
    return this.channelService.delete(+id);
  }

  @Get('channels/database')
  async getDatabaseChannels() {
    return this.channelService.findAllDatabase();
  }

  @Post('channels/database')
  async createDatabaseChannel(
    @Body() body: { channelId: string; channelName: string },
  ) {
    return this.channelService.createDatabaseChannel({
      channelId: body.channelId,
      channelName: body.channelName,
      isActive: true,
    });
  }

  @Delete('channels/database/:id')
  async deleteDatabaseChannel(@Param('id') id: number) {
    return this.channelService.deleteDatabaseChannel(+id);
  }

  // ==================== MOVIES ====================
  @Get('movies')
  async getMovies() {
    return this.movieService.findAll();
  }

  @Post('movies')
  async createMovie(@Body() body: any) {
    return this.movieService.create(body);
  }

  @Delete('movies/:id')
  async deleteMovie(@Request() req, @Param('id') id: number) {
    const canDelete =
      req.admin.role === AdminRole.SUPERADMIN || req.admin.canDeleteContent;
    if (!canDelete) {
      throw new HttpException(
        'No permission to delete content',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.movieService.delete(+id);
  }

  // ==================== SERIALS ====================
  @Get('serials')
  async getSerials() {
    return this.serialService.findAll();
  }

  @Post('serials')
  async createSerial(@Body() body: any) {
    return this.serialService.create(body);
  }

  @Delete('serials/:id')
  async deleteSerial(@Request() req, @Param('id') id: number) {
    const canDelete =
      req.admin.role === AdminRole.SUPERADMIN || req.admin.canDeleteContent;
    if (!canDelete) {
      throw new HttpException(
        'No permission to delete content',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.serialService.delete(+id);
  }

  // ==================== PAYMENTS ====================
  @Get('payments/pending')
  async getPendingPayments() {
    return this.paymentService.findPending();
  }

  @Put('payments/:id/approve')
  async approvePayment(
    @Request() req,
    @Param('id') id: number,
    @Body() body: { durationDays: number },
  ) {
    const hasPermission = await this.adminService.hasPermission(
      req.admin.telegramId,
      'APPROVE_PAYMENTS',
    );
    if (!hasPermission) {
      throw new HttpException(
        'No permission to approve payments',
        HttpStatus.FORBIDDEN,
      );
    }

    const admin = await this.adminService.getAdminByTelegramId(
      req.admin.telegramId,
    );
    return this.paymentService.approve(+id, admin!.id, body.durationDays);
  }

  @Put('payments/:id/reject')
  async rejectPayment(
    @Request() req,
    @Param('id') id: number,
    @Body() body: { reason?: string },
  ) {
    const hasPermission = await this.adminService.hasPermission(
      req.admin.telegramId,
      'APPROVE_PAYMENTS',
    );
    if (!hasPermission) {
      throw new HttpException(
        'No permission to reject payments',
        HttpStatus.FORBIDDEN,
      );
    }

    const admin = await this.adminService.getAdminByTelegramId(
      req.admin.telegramId,
    );
    return this.paymentService.reject(+id, admin!.id, body.reason);
  }
}
