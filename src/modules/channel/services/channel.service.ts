import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChannelType } from '@prisma/client';
import { Api } from 'grammy';

export interface SubscriptionStatus {
  isSubscribed: boolean;
  notSubscribedChannels: {
    channelId: string;
    channelName: string;
    channelLink: string;
  }[];
}

@Injectable()
export class ChannelService {
  constructor(private prisma: PrismaService) {}

  async create(
    channelId: string,
    channelName: string,
    channelLink: string,
    order?: number,
  ) {
    return this.prisma.mandatoryChannel.create({
      data: {
        channelId,
        channelName,
        channelLink,
        order: order || 0,
      },
    });
  }

  async findAll() {
    return this.prisma.mandatoryChannel.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: number) {
    return this.prisma.mandatoryChannel.findUnique({
      where: { id },
    });
  }

  async update(
    id: number,
    data: {
      channelId?: string;
      channelName?: string;
      channelLink?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.mandatoryChannel.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    return this.prisma.mandatoryChannel.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async reorder(ids: number[]) {
    const updates = ids.map((id, index) =>
      this.prisma.mandatoryChannel.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);
  }

  async findAllMandatory() {
    return this.prisma.mandatoryChannel.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async findAllDatabase() {
    return this.prisma.databaseChannel.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDatabaseChannel(data: {
    channelId: string;
    channelName: string;
    isActive?: boolean;
  }) {
    return this.prisma.databaseChannel.create({
      data: {
        channelId: data.channelId,
        channelName: data.channelName,
        isActive: data.isActive ?? true,
      },
    });
  }

  async createMandatoryChannel(data: {
    channelId?: string;
    channelName: string;
    channelLink: string;
    type: ChannelType;
    isActive?: boolean;
  }) {
    return this.prisma.mandatoryChannel.create({
      data: {
        channelId: data.channelId || null,
        channelName: data.channelName,
        channelLink: data.channelLink,
        type: data.type,
        isActive: data.isActive ?? true,
        order: 0,
      },
    });
  }

  async deleteDatabaseChannel(id: number) {
    return this.prisma.databaseChannel.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ==================== SUBSCRIPTION CHECKER ====================

  async checkSubscription(
    userId: number,
    api: Api,
  ): Promise<SubscriptionStatus> {
    const channels = await this.prisma.mandatoryChannel.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    const notSubscribed = [];

    for (const channel of channels) {
      try {
        const member = await api.getChatMember(channel.channelId, userId);

        if (!['member', 'administrator', 'creator'].includes(member.status)) {
          notSubscribed.push({
            channelId: channel.channelId,
            channelName: channel.channelName,
            channelLink: channel.channelLink,
          });
        }
      } catch (error) {
        notSubscribed.push({
          channelId: channel.channelId,
          channelName: channel.channelName,
          channelLink: channel.channelLink,
        });
      }
    }

    return {
      isSubscribed: notSubscribed.length === 0,
      notSubscribedChannels: notSubscribed,
    };
  }

  async hasNewChannels(userId: number, lastCheckDate: Date): Promise<boolean> {
    const newChannels = await this.prisma.mandatoryChannel.count({
      where: {
        isActive: true,
        createdAt: {
          gt: lastCheckDate,
        },
      },
    });

    return newChannels > 0;
  }
}
