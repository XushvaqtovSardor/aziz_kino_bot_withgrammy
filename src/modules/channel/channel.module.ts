import { Module } from '@nestjs/common';
import { ChannelService } from './services/channel.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ChannelService],
  exports: [ChannelService],
})
export class ChannelModule {}
