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
      select: {
        id: true,
        createdAt: true,
        channelId: true,
        channelLink: true,
        isActive: true,
        type: true,
        channelName: true,
        order: true,
        memberLimit: true,
        currentMembers: true,
        pendingRequests: true,
      },
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
      select: {
        id: true,
        createdAt: true,
        channelId: true,
        channelLink: true,
        isActive: true,
        type: true,
        channelName: true,
        order: true,
        memberLimit: true,
        currentMembers: true,
        pendingRequests: true,
      },
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
    memberLimit?: number | null;
  }) {
    return this.prisma.mandatoryChannel.create({
      data: {
        channelId: data.channelId || null,
        channelName: data.channelName,
        channelLink: data.channelLink,
        type: data.type,
        isActive: data.isActive ?? true,
        memberLimit: data.memberLimit,
        currentMembers: 0,
        pendingRequests: 0,
        order: 0,
      },
    });
  }

  async incrementMemberCount(channelId: number) {
    const channel = await this.prisma.mandatoryChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) return null;

    const updated = await this.prisma.mandatoryChannel.update({
      where: { id: channelId },
      data: {
        currentMembers: { increment: 1 },
      },
    });

    // Auto-disable if limit reached
    if (
      updated.memberLimit !== null &&
      updated.currentMembers >= updated.memberLimit
    ) {
      await this.prisma.mandatoryChannel.update({
        where: { id: channelId },
        data: { isActive: false },
      });
    }

    return updated;
  }

  async incrementPendingRequests(channelId: number) {
    return this.prisma.mandatoryChannel.update({
      where: { id: channelId },
      data: {
        pendingRequests: { increment: 1 },
      },
    });
  }

  async decrementPendingRequests(channelId: number) {
    return this.prisma.mandatoryChannel.update({
      where: { id: channelId },
      data: {
        pendingRequests: { decrement: 1 },
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

  /**
   * Check which channels user has NOT subscribed to or sent join request
   * Returns all unsubscribed channels including external ones
   */
  async checkUserSubscriptionStatus(
    userId: number,
    api: Api,
    joinRequestCache: Map<string, number>,
  ) {
    const allChannels = await this.prisma.mandatoryChannel.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    const unsubscribedChannels: {
      id: number;
      channelId: string;
      channelName: string;
      channelLink: string;
      type: string;
      status?: string;
      isExternal: boolean;
    }[] = [];

    const subscribedChannels: {
      id: number;
      channelId: string;
      channelName: string;
      type: string;
      isSubscribed: boolean;
      hasPendingRequest: boolean;
    }[] = [];

    for (const channel of allChannels) {
      // External channels are always included in unsubscribed (user can't verify)
      if (channel.type === 'EXTERNAL') {
        unsubscribedChannels.push({
          id: channel.id,
          channelId: channel.channelId,
          channelName: channel.channelName,
          channelLink: channel.channelLink,
          type: channel.type,
          isExternal: true,
        });
        continue;
      }

      // Check cache for join requests
      const cacheKey = `${userId}_${channel.channelId}`;
      const hasPendingRequest = joinRequestCache.has(cacheKey);

      try {
        const member = await api.getChatMember(channel.channelId, userId);

        const isSubscribed =
          member.status === 'member' ||
          member.status === 'administrator' ||
          member.status === 'creator' ||
          (member.status === 'restricted' &&
            'is_member' in member &&
            member.is_member);

        // If subscribed OR has pending request for PRIVATE channel, mark as subscribed
        if (isSubscribed || (hasPendingRequest && channel.type === 'PRIVATE')) {
          subscribedChannels.push({
            id: channel.id,
            channelId: channel.channelId,
            channelName: channel.channelName,
            type: channel.type,
            isSubscribed,
            hasPendingRequest,
          });
        } else {
          unsubscribedChannels.push({
            id: channel.id,
            channelId: channel.channelId,
            channelName: channel.channelName,
            channelLink: channel.channelLink,
            type: channel.type,
            status: member.status,
            isExternal: false,
          });
        }
      } catch (error) {
        // If error (user not in channel), add to unsubscribed
        unsubscribedChannels.push({
          id: channel.id,
          channelId: channel.channelId,
          channelName: channel.channelName,
          channelLink: channel.channelLink,
          type: channel.type,
          status: 'error',
          isExternal: false,
        });
      }
    }

    return {
      allChannels,
      unsubscribedChannels,
      subscribedChannels,
      totalChannels: allChannels.length,
      unsubscribedCount: unsubscribedChannels.length,
      subscribedCount: subscribedChannels.length,
      // User can access bot only if all non-external channels are subscribed
      canAccessBot:
        unsubscribedChannels.filter((ch) => !ch.isExternal).length === 0,
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

  // Barcha kanallarni olish (active va inactive)
  async findAllWithHistory() {
    return this.prisma.mandatoryChannel.findMany({
      orderBy: [
        { isActive: 'desc' }, // Active kanallar birinchi
        { createdAt: 'desc' }, // Eng yangilar birinchi
      ],
      select: {
        id: true,
        createdAt: true,
        channelId: true,
        channelLink: true,
        isActive: true,
        type: true,
        channelName: true,
        order: true,
        memberLimit: true,
        currentMembers: true,
        pendingRequests: true,
      },
    });
  }

  // Link bo'yicha kanal qidirish
  async findByLink(link: string) {
    return this.prisma.mandatoryChannel.findFirst({
      where: {
        channelLink: {
          contains: link,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        createdAt: true,
        channelId: true,
        channelLink: true,
        isActive: true,
        type: true,
        channelName: true,
        order: true,
        memberLimit: true,
        currentMembers: true,
        pendingRequests: true,
      },
    });
  }
}
