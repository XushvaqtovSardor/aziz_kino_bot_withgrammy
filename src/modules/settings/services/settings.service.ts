import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.botSettings.findFirst();

    if (!settings) {
      settings = await this.prisma.botSettings.create({
        data: {
          aboutBot: 'Bu kino bot',
          supportUsername: 'support',
          adminNotificationChat: '0',
<<<<<<< HEAD
          welcomeMessage: '👋',
=======
          welcomeMessage: 'Xush kelibsiz!',
>>>>>>> 9e7ed34722035ce8c5e304e50c0ff830bf2359f3
        },
      });
    }

    return settings;
  }

  async updateAboutBot(aboutBot: string) {
    const settings = await this.getSettings();

    return this.prisma.botSettings.update({
      where: { id: settings.id },
      data: { aboutBot },
    });
  }

  async updateSupportUsername(supportUsername: string) {
    const settings = await this.getSettings();

    return this.prisma.botSettings.update({
      where: { id: settings.id },
      data: { supportUsername },
    });
  }

  async updateAdminNotificationChat(adminNotificationChat: string) {
    const settings = await this.getSettings();

    return this.prisma.botSettings.update({
      where: { id: settings.id },
      data: { adminNotificationChat },
    });
  }

<<<<<<< HEAD
  async updateContactMessage(contactMessage: string) {
    const settings = await this.getSettings();

    return this.prisma.botSettings.update({
      where: { id: settings.id },
      data: { contactMessage },
    });
  }

=======
>>>>>>> 9e7ed34722035ce8c5e304e50c0ff830bf2359f3
  async updateSettings(data: {
    aboutBot?: string;
    supportUsername?: string;
    adminNotificationChat?: string;
  }) {
    const settings = await this.getSettings();

    return this.prisma.botSettings.update({
      where: { id: settings.id },
      data,
    });
  }
}
