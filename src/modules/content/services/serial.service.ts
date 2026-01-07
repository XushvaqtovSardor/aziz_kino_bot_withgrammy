import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SerialData } from '../interfaces/content-data.interface';

@Injectable()
export class SerialService {
  constructor(private prisma: PrismaService) {}

  async create(data: SerialData) {
    const codeNum =
      typeof data.code === 'string' ? parseInt(data.code) : data.code;

    return this.prisma.serial.create({
      data: {
        ...data,
        code: codeNum,
        shareLink: this.generateShareLink(String(codeNum)),
      },
      include: {
        field: true,
      },
    });
  }

  async findByCode(code: string) {
    const codeNum = parseInt(code);
    if (isNaN(codeNum)) return null;

    return this.prisma.serial.findUnique({
      where: { code: codeNum },
      include: {
        field: true,
        episodes: {
          orderBy: { episodeNumber: 'asc' },
        },
      },
    });
  }

  async findById(id: number) {
    return this.prisma.serial.findUnique({
      where: { id },
      include: {
        field: true,
        episodes: {
          orderBy: { episodeNumber: 'asc' },
        },
      },
    });
  }

  async findNearestAvailableCodes(
    targetCode: number,
    limit: number = 5,
  ): Promise<number[]> {
    // Find all codes in database
    const existingSerials = await this.prisma.serial.findMany({
      select: { code: true },
      orderBy: { code: 'asc' },
    });

    const usedCodes = new Set(existingSerials.map((s) => s.code));
    const availableCodes: number[] = [];

    // Search for available codes near targetCode
    let offset = 1;
    while (availableCodes.length < limit && offset <= 1000) {
      const lowerCode = targetCode - offset;
      const upperCode = targetCode + offset;

      if (lowerCode > 0 && !usedCodes.has(lowerCode)) {
        availableCodes.push(lowerCode);
      }

      if (!usedCodes.has(upperCode)) {
        availableCodes.push(upperCode);
      }

      offset++;
    }

    return availableCodes.slice(0, limit).sort((a, b) => a - b);
  }

  async findAll(fieldId?: number) {
    return this.prisma.serial.findMany({
      where: fieldId ? { fieldId } : undefined,
      include: {
        field: true,
        episodes: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: number,
    data: Partial<Omit<SerialData, 'code' | 'fieldId'>>,
  ) {
    return this.prisma.serial.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    // This will cascade delete all episodes
    return this.prisma.serial.delete({
      where: { id },
    });
  }

  async incrementViews(code: string) {
    const codeNum = parseInt(code);
    if (isNaN(codeNum)) return null;

    return this.prisma.serial.update({
      where: { code: codeNum },
      data: {
        views: {
          increment: 1,
        },
      },
    });
  }

  async incrementTotalEpisodes(id: number) {
    return this.prisma.serial.update({
      where: { id },
      data: {
        totalEpisodes: {
          increment: 1,
        },
      },
    });
  }

  async getTopSerials(limit: number = 10) {
    return this.prisma.serial.findMany({
      take: limit,
      orderBy: { views: 'desc' },
      include: {
        field: true,
        episodes: true,
      },
    });
  }

  async search(query: string) {
    // Try to parse query as number for code search
    const codeQuery = parseInt(query);

    return this.prisma.serial.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { genre: { contains: query, mode: 'insensitive' } },
          ...(isNaN(codeQuery) ? [] : [{ code: codeQuery }]),
        ],
      },
      include: {
        field: true,
        episodes: true,
      },
      take: 20,
    });
  }

  formatSerialCaption(serial: any): string {
    let caption = `#${serial.code} ${serial.title}\n\n`;

    if (serial.genre) caption += `🎭 Жанр: ${serial.genre}\n`;
    caption += `📺 Қисмлар: ${serial.totalEpisodes}\n`;
    caption += `📁 Field: ${serial.field.name}\n`;
    if (serial.description) caption += `\n${serial.description}`;

    return caption;
  }

  private generateShareLink(code: string): string {
    return `https://t.me/share/url?url=📺 Сериал: ${code}`;
  }

  async postToChannel(
    bot: any,
    channelId: string,
    serial: any,
    posterFileId: string,
  ) {
    const caption = this.formatSerialCaption(serial);

    return bot.telegram.sendPhoto(channelId, posterFileId, {
      caption,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📺 Қисмларни кўриш',
              callback_data: `view_serial_${serial.code}`,
            },
          ],
        ],
      },
    });
  }

  generateEpisodesKeyboard(episodes: any[], serialCode: string) {
    const buttons = [];
    const row = [];

    episodes.forEach((episode, index) => {
      row.push({
        text: `${episode.episodeNumber}`,
        callback_data: `episode_${serialCode}_${episode.episodeNumber}`,
      });

      // 5 episodes per row
      if ((index + 1) % 5 === 0 || index === episodes.length - 1) {
        buttons.push([...row]);
        row.length = 0;
      }
    });

    return {
      inline_keyboard: buttons,
    };
  }
}
