import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BotContext } from '../../bot/bot.context';
import { InlineKeyboard, Keyboard } from 'grammy';
import { AdminService } from './services/admin.service';
import { UserService } from '../user/services/user.service';
import { MovieService } from '../content/services/movie.service';
import { SerialService } from '../content/services/serial.service';
import { SerialManagementService } from './services/serial-management.service';
import { FieldService } from '../field/services/field.service';
import { PaymentService } from '../payment/services/payment.service';
import { WatchHistoryService } from '../content/services/watch-history.service';
import { BroadcastService } from '../broadcast/services/broadcast.service';
import { ChannelService } from '../channel/services/channel.service';
import { SessionService } from './services/session.service';
import { PremiumService } from '../payment/services/premium.service';
import { SettingsService } from '../settings/services/settings.service';
import { GrammyBotService } from '../../common/grammy/grammy-bot.module';
import { ChannelType } from '@prisma/client';
import {
  AdminState,
  MovieCreateStep,
  SerialCreateStep,
} from './types/session.interface';
import { AdminKeyboard } from './keyboards/admin-menu.keyboard';

@Injectable()
export class AdminHandler implements OnModuleInit {
  private readonly logger = new Logger(AdminHandler.name);

  constructor(
    private adminService: AdminService,
    private userService: UserService,
    private movieService: MovieService,
    private serialService: SerialService,
    private serialManagementService: SerialManagementService,
    private fieldService: FieldService,
    private paymentService: PaymentService,
    private watchHistoryService: WatchHistoryService,
    private broadcastService: BroadcastService,
    private channelService: ChannelService,
    private sessionService: SessionService,
    private premiumService: PremiumService,
    private settingsService: SettingsService,
    private grammyBot: GrammyBotService,
  ) {}

  onModuleInit() {
    this.registerHandlers();
    this.logger.log('Admin handlers registered with Grammy');
  }

  private registerHandlers() {
    const bot = this.grammyBot.bot;

    // /admin command - ONLY for admins
    bot.command('admin', async (ctx) => {
      if (!ctx.from) return;

      this.logger.log(`[/admin] Command received from user ${ctx.from.id}`);

      const admin = await this.getAdmin(ctx);
      if (admin) {
        this.logger.log(
          `[/admin] Admin verified: ${admin.telegramId}, showing admin panel`,
        );
        await this.handleAdminStart(ctx, admin);
      } else {
        this.logger.warn(
          `[/admin] User ${ctx.from.id} tried to access admin panel but is not admin`,
        );
        await ctx.reply('❌ Siz admin emassiz!');
      }
    });

    // Admin menu buttons - only work for admins
    bot.hears(
      '📊 Statistika',
      this.withAdminCheck(this.showStatistics.bind(this)),
    );
    bot.hears('🔙 Orqaga', this.withAdminCheck(this.handleBack.bind(this)));
    bot.hears(
      '❌ Bekor qilish',
      this.withAdminCheck(this.handleCancel.bind(this)),
    );
    bot.hears(
      '🎬 Kino yuklash',
      this.withAdminCheck(this.startMovieCreation.bind(this)),
    );
    bot.hears(
      '📺 Serial yuklash',
      this.withAdminCheck(this.startSerialCreation.bind(this)),
    );
    bot.hears(
      '🆕 Yangi serial yaratish',
      this.withAdminCheck(this.startNewSerialCreation.bind(this)),
    );
    bot.hears(
      "➕ Mavjud serialga qism qo'shish",
      this.withAdminCheck(this.startAddingEpisode.bind(this)),
    );
    bot.hears(
      '📹 Kinoga video biriktirish',
      this.withAdminCheck(this.startVideoAttachment.bind(this)),
    );
    bot.hears(
      '📁 Fieldlar',
      this.withAdminCheck(this.openFieldsMenu.bind(this)),
    );
    bot.hears(
      "➕ Field qo'shish",
      this.withAdminCheck(this.startAddingField.bind(this)),
    );
    bot.hears(
      "📋 Fieldlar ro'yxati",
      this.withAdminCheck(this.showFieldsList.bind(this)),
    );
    bot.hears(
      '📢 Majburiy kanallar',
      this.withAdminCheck(this.showMandatoryChannels.bind(this)),
    );
    bot.hears(
      "➕ Majburiy kanal qo'shish",
      this.withAdminCheck(this.startAddMandatoryChannel.bind(this)),
    );
    bot.hears(
      '💾 Database kanallar',
      this.withAdminCheck(this.showDatabaseChannels.bind(this)),
    );
    bot.hears(
      "➕ Database kanal qo'shish",
      this.withAdminCheck(this.startAddDatabaseChannel.bind(this)),
    );
    bot.hears(
      "💳 To'lovlar",
      this.withAdminCheck(this.showPaymentsMenu.bind(this)),
    );
    bot.hears(
      "📥 Yangi to'lovlar",
      this.withAdminCheck(this.showPendingPayments.bind(this)),
    );
    bot.hears(
      '👥 Adminlar',
      this.withAdminCheck(this.showAdminsList.bind(this)),
    );
    bot.hears(
      '⚙️ Sozlamalar',
      this.withAdminCheck(this.showSettings.bind(this)),
    );
    bot.hears(
      '📣 Reklama yuborish',
      this.withAdminCheck(this.startBroadcast.bind(this)),
    );
    bot.hears(
      '🌐 Web Panel',
      this.withAdminCheck(this.showWebPanel.bind(this)),
    );

    // Callback query handlers - all with admin check
    bot.callbackQuery(/^field_detail_(\d+)$/, async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.showFieldDetail(ctx);
    });

    bot.callbackQuery('back_to_fields', async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.backToFieldsList(ctx);
    });

    bot.callbackQuery(/^delete_field_(\d+)$/, async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.deleteField(ctx);
    });

    bot.callbackQuery(/^delete_mandatory_(\d+)$/, async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.deleteMandatoryChannel(ctx);
    });

    bot.callbackQuery(/^delete_db_channel_(\d+)$/, async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.deleteDatabaseChannel(ctx);
    });

    bot.callbackQuery(/^approve_payment_(\d+)$/, async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.approvePayment(ctx);
    });

    bot.callbackQuery(/^reject_payment_(\d+)$/, async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.rejectPayment(ctx);
    });

    bot.callbackQuery('add_new_admin', async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.startAddingAdmin(ctx);
    });

    bot.callbackQuery(/^delete_admin_(.+)$/, async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.deleteAdmin(ctx);
    });

    bot.callbackQuery('edit_prices', async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.startEditingPrices(ctx);
    });

    bot.callbackQuery('edit_card', async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.startEditingCard(ctx);
    });

    bot.callbackQuery('back_to_admin_menu', async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.backToAdminMenu(ctx);
    });

    bot.callbackQuery(/^broadcast_(all|premium|free)$/, async (ctx) => {
      const admin = await this.getAdmin(ctx);
      if (admin) await this.handleBroadcastType(ctx);
    });

    // Media handlers - ONLY work if admin is in a session
    bot.on('message:photo', async (ctx, next) => {
      if (!ctx.from) {
        await next();
        return;
      }
      const admin = await this.getAdmin(ctx);
      const session = this.sessionService.getSession(ctx.from.id);

      if (admin && session) {
        await this.handlePhoto(ctx);
      } else {
        await next(); // Let user handler process it
      }
    });

    bot.on('message:video', async (ctx, next) => {
      if (!ctx.from) {
        await next();
        return;
      }
      const admin = await this.getAdmin(ctx);
      const session = this.sessionService.getSession(ctx.from.id);

      if (admin && session) {
        await this.handleVideoMessage(ctx);
      } else {
        await next(); // Let user handler process it
      }
    });

    // Text handler - ONLY work if admin is in a session
    bot.on('message:text', async (ctx, next) => {
      if (!ctx.from) {
        await next();
        return;
      }
      const admin = await this.getAdmin(ctx);
      const session = this.sessionService.getSession(ctx.from.id);

      if (admin && session) {
        await this.handleSessionText(ctx);
      } else {
        await next(); // Let user handler process it
      }
    });
  }

  private async getAdmin(ctx: BotContext) {
    if (!ctx.from) return null;
    const admin = await this.adminService.getAdminByTelegramId(
      String(ctx.from.id),
    );
    if (admin) {
      this.logger.log(
        `[getAdmin] Found admin: ${admin.telegramId} (${admin.role})`,
      );
    } else {
      this.logger.warn(`[getAdmin] User ${ctx.from.id} is not an admin`);
    }
    return admin;
  }

  // Helper to wrap handlers with admin check
  private withAdminCheck(handler: (ctx: BotContext) => Promise<void>) {
    return async (ctx: BotContext) => {
      const admin = await this.getAdmin(ctx);
      if (admin) {
        await handler(ctx);
      }
    };
  }

  // ==================== START COMMAND ====================
  private async handleAdminStart(ctx: BotContext, admin: any) {
    this.logger.log(
      `[handleAdminStart] Showing admin panel for ${admin.telegramId}`,
    );

    // Clear any existing session
    this.sessionService.clearSession(ctx.from!.id);

    const welcomeMessage = `👋 Assalomu alaykum, ${admin.username || 'Admin'}!\n\n🔐 Siz admin panelidasiz.`;

    await ctx.reply(welcomeMessage, AdminKeyboard.getAdminMainMenu(admin.role));
  }

  // ==================== BASIC HANDLERS ====================
  private async handleBack(ctx: BotContext) {
    if (!ctx.from) return;
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    this.sessionService.clearSession(ctx.from.id);
    await ctx.reply(
      '🏠 Asosiy menyu',
      AdminKeyboard.getAdminMainMenu(admin.role),
    );
  }

  private async handleCancel(ctx: BotContext) {
    if (!ctx.from) return;
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    this.sessionService.clearSession(ctx.from.id);
    await ctx.reply(
      '❌ Bekor qilindi.',
      AdminKeyboard.getAdminMainMenu(admin.role),
    );
  }

  // ==================== STATISTICS ====================
  private async showStatistics(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    try {
      const [userStats, paymentStats, activeUsers, newUsers] =
        await Promise.all([
          this.userService.getUserStatistics(),
          this.paymentService.getStatistics(),
          this.watchHistoryService.getActiveUsers(30),
          this.watchHistoryService.getNewUsers(30),
        ]);

      const message = `
📊 **BOT STATISTIKASI**

👥 **Foydalanuvchilar:**
├ Jami: ${userStats.totalUsers}
├ Premium: ${userStats.premiumUsers}
├ Bloklangan: ${userStats.blockedUsers}
└ Faol (30 kun): ${activeUsers}

💰 **To'lovlar:**
├ Jami: ${paymentStats.totalPayments}
├ Tasdiqlangan: ${paymentStats.approvedCount}
├ Rad etilgan: ${paymentStats.rejectedCount}
└ Kutilmoqda: ${paymentStats.pendingCount}

📈 **Yangi foydalanuvchilar (30 kun):** ${newUsers}
      `;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Error showing statistics:', error);
      await ctx.reply('❌ Statistikani olishda xatolik yuz berdi.');
    }
  }

  // ==================== MOVIE CREATION ====================
  private async startMovieCreation(ctx: BotContext) {
    this.logger.log(`Admin ${ctx.from?.id} starting movie creation`);

    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) {
      await ctx.reply("❌ Sizda admin huquqi yo'q.");
      return;
    }

    this.sessionService.createSession(ctx.from.id, AdminState.CREATING_MOVIE);

    await ctx.reply(
      '🎬 Kino yuklash boshlandi!\n\n' +
        '1️⃣ Kino kodini kiriting:\n' +
        "⚠️ Kod FAQAT raqamlardan iborat bo'lishi kerak!\n" +
        'Masalan: 12345',
      AdminKeyboard.getCancelButton(),
    );
  }

  // ==================== PHOTO HANDLER ====================
  private async handlePhoto(ctx: BotContext) {
    if (!ctx.from || !ctx.message || !('photo' in ctx.message)) return;

    const session = this.sessionService.getSession(ctx.from.id);
    if (!session) return;

    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const photo = ctx.message.photo[ctx.message.photo.length - 1];

    // Handle Movie Photo
    if (
      session.state === AdminState.CREATING_MOVIE &&
      session.step === MovieCreateStep.PHOTO
    ) {
      this.sessionService.updateSessionData(ctx.from.id, {
        posterFileId: photo.file_id,
      });
      this.sessionService.setStep(ctx.from.id, MovieCreateStep.VIDEO);

      await ctx.reply(
        '🎬 Endi kino videosini yuboring:',
        AdminKeyboard.getCancelButton(),
      );
      return;
    }

    // Handle Serial Photo
    if (
      session.state === AdminState.CREATING_SERIAL &&
      session.step === SerialCreateStep.PHOTO
    ) {
      // Instead of creating serial immediately, save poster and ask for episodes
      await this.serialManagementService.handleSerialPoster(ctx, photo.file_id);
      return;
    }
  }

  // ==================== VIDEO HANDLER ====================
  private async handleVideoMessage(ctx: BotContext) {
    if (!ctx.from || !ctx.message || !('video' in ctx.message)) return;

    const session = this.sessionService.getSession(ctx.from.id);
    if (!session) return;

    // Check if creating movie
    if (
      session.state === AdminState.CREATING_MOVIE &&
      session.step === MovieCreateStep.VIDEO
    ) {
      await this.handleMovieVideo(ctx);
      return;
    }

    // Check if creating serial and uploading episodes
    if (session.state === AdminState.CREATING_SERIAL && session.step === 6) {
      // step 6 = UPLOADING_EPISODES (new serial)
      await this.serialManagementService.handleNewSerialEpisodeVideo(
        ctx,
        ctx.message.video.file_id,
        session,
      );
      return;
    }

    // Check if adding episodes to existing serial
    if (session.state === AdminState.CREATING_SERIAL && session.step === 7) {
      // step 7 = ADDING_EPISODES (existing serial)
      await this.serialManagementService.handleExistingSerialEpisodeVideo(
        ctx,
        ctx.message.video.file_id,
        session,
      );
      return;
    }
  }

  private async handleMovieVideo(ctx: BotContext) {
    if (!ctx.from || !ctx.message || !('video' in ctx.message)) return;

    const session = this.sessionService.getSession(ctx.from.id);
    if (
      !session ||
      session.state !== AdminState.CREATING_MOVIE ||
      session.step !== MovieCreateStep.VIDEO
    ) {
      return;
    }

    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const video = ctx.message.video;
    const data = session.data;

    try {
      // Get all database channels
      const dbChannels = await this.channelService.findAllDatabase();
      if (dbChannels.length === 0) {
        await ctx.reply(
          '❌ Hech qanday database kanal topilmadi. Avval database kanal yarating.',
        );
        this.sessionService.clearSession(ctx.from.id);
        return;
      }

      await ctx.reply('⏳ Kino yuklanmoqda, iltimos kuting...');

      // Send video to all database channels and collect message IDs
      const videoMessages: { channelId: string; messageId: number }[] = [];

      for (const dbChannel of dbChannels) {
        try {
          const sentVideo = await ctx.api.sendVideo(
            dbChannel.channelId,
            video.file_id,
            {
              caption: `🎬 ${data.title || 'Kino'}\n🆔 Kod: ${data.code}`,
            },
          );
          videoMessages.push({
            channelId: dbChannel.channelId,
            messageId: sentVideo.message_id,
          });
        } catch (error) {
          this.logger.error(
            `Error sending to database channel ${dbChannel.channelName}:`,
            error,
          );
        }
      }

      if (videoMessages.length === 0) {
        await ctx.reply(
          "❌ Videoni hech qanday kanalga yuklash imkoni bo'lmadi. Botni kanallarga admin qiling.",
        );
        return;
      }

      // Get field info first
      const field = data.selectedField;

      // Create movie caption with button for field channel (DMC style)
      const caption = `
${data.title}

${data.description || ''}

📖 Qism: ${data.episodeCount || 1}
🎭 Janrlari: ${data.genre}
🔖 Kanal: ${field.channelLink || '@' + field.name}
      `.trim();

      const keyboard = new InlineKeyboard().url(
        '✨ Tomosha Qilish',
        `https://t.me/${this.grammyBot.botUsername}?start=${data.code}`,
      );

      // Send poster with info to field channel
      const sentPoster = await ctx.api.sendPhoto(
        field.channelId,
        data.posterFileId,
        {
          caption,
          reply_markup: keyboard,
        },
      );

      // Save movie to database
      await this.movieService.create({
        code: data.code,
        title: data.title,
        genre: data.genre,
        description: data.description,
        fieldId: field.id,
        posterFileId: data.posterFileId,
        videoFileId: video.file_id,
        channelMessageId: sentPoster.message_id,
        videoMessageId: JSON.stringify(videoMessages),
      });

      this.sessionService.clearSession(ctx.from.id);

      let successMessage = `✅ Kino muvaffaqiyatli yuklandi!\n\n`;
      successMessage += `📦 Field kanal: ${field.name}\n`;
      successMessage += `🔗 Poster Message ID: ${sentPoster.message_id}\n\n`;
      successMessage += `📹 Video yuklangan kanallar:\n`;
      videoMessages.forEach((vm, i) => {
        const channel = dbChannels.find((ch) => ch.channelId === vm.channelId);
        successMessage += `${i + 1}. ${channel?.channelName || vm.channelId} - Message ID: ${vm.messageId}\n`;
      });

      await ctx.reply(
        successMessage,
        AdminKeyboard.getAdminMainMenu(admin.role),
      );
    } catch (error) {
      this.logger.error('Error uploading movie:', error);
      await ctx.reply(
        `❌ Xatolik yuz berdi. Botni barcha kanallarga admin qiling va qaytadan urinib ko'ring.\n\nXatolik: ${error.message}`,
      );
    }
  }

  // ==================== TEXT HANDLER (Session-based) ====================
  private async handleSessionText(ctx: BotContext) {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text;
    const session = this.sessionService.getSession(ctx.from.id);

    // Skip if no session or it's a command/button
    if (!session || text.startsWith('/') || text.includes('�')) return;

    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    // Handle cancel button
    if (text === '❌ Bekor qilish') {
      this.sessionService.clearSession(ctx.from.id);
      await ctx.reply(
        '❌ Bekor qilindi.',
        AdminKeyboard.getAdminMainMenu(admin.role),
      );
      return;
    }

    // Route to appropriate handler based on state
    switch (session.state) {
      case AdminState.CREATING_MOVIE:
        await this.handleMovieCreationSteps(ctx, text, session);
        break;
      case AdminState.CREATING_SERIAL:
        await this.handleSerialCreationSteps(ctx, text, session);
        break;
      case AdminState.ATTACHING_VIDEO:
        await this.handleVideoAttachmentSteps(ctx, text, session);
        break;
      case AdminState.ADDING_FIELD:
        await this.handleFieldCreationSteps(ctx, text, session);
        break;
      case AdminState.ADD_DATABASE_CHANNEL:
        await this.handleDatabaseChannelCreationSteps(ctx, text, session);
        break;
      case AdminState.ADD_MANDATORY_CHANNEL:
        await this.handleMandatoryChannelCreationSteps(ctx, text, session);
        break;
      case AdminState.ADD_ADMIN:
        await this.handleAdminCreationSteps(ctx, text, session);
        break;
      case AdminState.EDIT_PREMIUM_PRICES:
        await this.handlePriceEditingSteps(ctx, text, session);
        break;
      case AdminState.EDIT_CARD_INFO:
        await this.handleCardEditingSteps(ctx, text, session);
        break;
      case AdminState.BROADCASTING:
        await this.handleBroadcastMessage(ctx, text, session);
        break;
      default:
        this.logger.warn(`Unhandled session state: ${session.state}`);
        break;
    }
  }

  private async handleMovieCreationSteps(
    ctx: BotContext,
    text: string,
    session: any,
  ) {
    const data = session.data || {};

    switch (session.step) {
      case MovieCreateStep.CODE:
        const code = parseInt(text);
        if (isNaN(code) || code <= 0) {
          await ctx.reply(
            "❌ Kod faqat raqamlardan iborat bo'lishi kerak!\nMasalan: 12345\n\nIltimos, qaytadan kiriting:",
            AdminKeyboard.getCancelButton(),
          );
          return;
        }

        // Check if code is available
        const isAvailable = await this.movieService.isCodeAvailable(code);
        if (!isAvailable) {
          const nearestCodes =
            await this.movieService.findNearestAvailableCodes(code, 5);
          let message = `❌ Kechirasiz, ${code} kodi band!\n\n`;
          if (nearestCodes.length > 0) {
            message += "✅ Eng yaqin bo'sh kodlar:\n";
            nearestCodes.forEach((c, i) => {
              message += `${i + 1}. ${c}\n`;
            });
            message +=
              '\nYuqoridagi kodlardan birini tanlang yoki boshqa kod kiriting:';
          } else {
            message += 'Boshqa kod kiriting:';
          }
          await ctx.reply(message, AdminKeyboard.getCancelButton());
          return;
        }

        this.sessionService.updateSessionData(ctx.from!.id, { code });
        this.sessionService.setStep(ctx.from!.id, MovieCreateStep.TITLE);
        await ctx.reply(
          'Kino nomini kiriting:\nMasalan: Avatar 2',
          AdminKeyboard.getCancelButton(),
        );
        break;

      case MovieCreateStep.TITLE:
        this.sessionService.updateSessionData(ctx.from!.id, { title: text });
        this.sessionService.setStep(ctx.from!.id, MovieCreateStep.GENRE);
        await ctx.reply(
          '🎭 Janr kiriting:\nMasalan: Action, Drama',
          AdminKeyboard.getCancelButton(),
        );
        break;

      case MovieCreateStep.GENRE:
        this.sessionService.updateSessionData(ctx.from!.id, { genre: text });
        this.sessionService.setStep(ctx.from!.id, MovieCreateStep.DESCRIPTION);

        const keyboard = new Keyboard()
          .text('Next')
          .row()
          .text('❌ Bekor qilish');
        await ctx.reply(
          "📝 Tavsif kiriting:\n\n⏭ O'tkazib yuborish uchun 'Next' yozing",
          { reply_markup: keyboard.resized() },
        );
        break;

      case MovieCreateStep.DESCRIPTION:
        if (text.toLowerCase() === 'next') {
          this.sessionService.updateSessionData(ctx.from!.id, {
            description: null,
          });
        } else {
          this.sessionService.updateSessionData(ctx.from!.id, {
            description: text,
          });
        }
        this.sessionService.setStep(ctx.from!.id, MovieCreateStep.FIELD);

        // Show fields list
        const allFields = await this.fieldService.findAll();
        if (allFields.length === 0) {
          await ctx.reply(
            '❌ Hech qanday field topilmadi. Avval field yarating.',
          );
          this.sessionService.clearSession(ctx.from!.id);
          return;
        }

        let message = '📁 Qaysi fieldni tanlaysiz?\n\n';
        allFields.forEach((field, index) => {
          message += `${index + 1}. ${field.name}\n`;
        });
        message += '\nRaqamini kiriting (masalan: 1)';

        this.sessionService.updateSessionData(ctx.from!.id, {
          fields: allFields,
        });
        await ctx.reply(message, AdminKeyboard.getCancelButton());
        break;

      case MovieCreateStep.FIELD:
        const fieldIndex = parseInt(text) - 1;
        const userFields = session.data.fields;

        if (
          isNaN(fieldIndex) ||
          fieldIndex < 0 ||
          fieldIndex >= userFields.length
        ) {
          await ctx.reply("❌ Noto'g'ri raqam. Iltimos qaytadan kiriting:");
          return;
        }

        this.sessionService.updateSessionData(ctx.from!.id, {
          selectedField: userFields[fieldIndex],
        });
        this.sessionService.setStep(ctx.from!.id, MovieCreateStep.PHOTO);
        await ctx.reply(
          '📸 Endi kino rasmini yuboring:',
          AdminKeyboard.getCancelButton(),
        );
        break;
    }
  }

  // ==================== SERIAL MANAGEMENT ====================
  private async startSerialCreation(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) {
      await ctx.reply("❌ Sizda admin huquqi yo'q.");
      return;
    }

    const keyboard = new Keyboard()
      .text('🆕 Yangi serial yaratish')
      .row()
      .text("➕ Mavjud serialga qism qo'shish")
      .row()
      .text('❌ Bekor qilish')
      .resized();

    await ctx.reply('📺 Serial boshqaruvi\n\nQaysi amalni bajarmoqchisiz?', {
      reply_markup: keyboard,
    });
  }

  private async startNewSerialCreation(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) {
      await ctx.reply("❌ Sizda admin huquqi yo'q.");
      return;
    }

    this.sessionService.createSession(ctx.from.id, AdminState.CREATING_SERIAL);
    this.sessionService.updateSessionData(ctx.from.id, { isNewSerial: true });

    await ctx.reply(
      '📺 Yangi serial yaratish boshlandi!\n\n' +
        '1️⃣ Serial kodini kiriting:\n' +
        "⚠️ Kod FAQAT raqamlardan iborat bo'lishi kerak!\n" +
        'Masalan: 12345',
      AdminKeyboard.getCancelButton(),
    );
  }

  private async startAddingEpisode(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) {
      await ctx.reply("❌ Sizda admin huquqi yo'q.");
      return;
    }

    this.sessionService.createSession(ctx.from.id, AdminState.CREATING_SERIAL);
    this.sessionService.updateSessionData(ctx.from.id, {
      isAddingEpisode: true,
    });

    await ctx.reply(
      "📺 Serialga qism qo'shish\n\n" + 'Serial kodini kiriting:',
      AdminKeyboard.getCancelButton(),
    );
  }

  private async startVideoAttachment(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) {
      await ctx.reply("❌ Sizda admin huquqi yo'q.");
      return;
    }

    this.sessionService.createSession(ctx.from.id, AdminState.ATTACHING_VIDEO);
    await ctx.reply(
      '📹 Kinoga video biriktirish boshlandi!\n\n' + '🔢 Kino kodini kiriting:',
      AdminKeyboard.getCancelButton(),
    );
  }

  // ==================== FIELD MANAGEMENT ====================
  private async openFieldsMenu(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) {
      await ctx.reply("❌ Sizda admin huquqi yo'q.");
      return;
    }

    await ctx.reply(
      '📁 Fieldlar bolimi',
      AdminKeyboard.getFieldManagementMenu(),
    );
  }

  private async startAddingField(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) return;

    this.sessionService.createSession(ctx.from.id, AdminState.ADDING_FIELD);
    await ctx.reply(
      '📝 Field nomini kiriting:\nMasalan: Yangi kinolar',
      AdminKeyboard.getCancelButton(),
    );
  }

  private async showFieldsList(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const fields = await this.fieldService.findAll();
    if (fields.length === 0) {
      await ctx.reply('📂 Hech qanday field topilmadi.');
      return;
    }

    let message = '📋 Mavjud fieldlar:\n\n';
    fields.forEach((field, index) => {
      message += `${index + 1}. ${field.name}\n`;
    });
    message += "\n👇 Batafsil ma'lumot olish uchun raqamni bosing:";

    const keyboard = new InlineKeyboard();
    fields.forEach((field, index) => {
      keyboard.text(String(index + 1), `field_detail_${field.id}`);
      if ((index + 1) % 5 === 0) keyboard.row();
    });

    await ctx.reply(message, { reply_markup: keyboard });
  }

  private async showFieldDetail(ctx: BotContext) {
    const fieldId = parseInt(ctx.match![1] as string);
    const field = await this.fieldService.findOne(fieldId);

    if (!field) {
      await ctx.answerCallbackQuery({ text: '❌ Field topilmadi' });
      return;
    }

    const message = `
📁 **Field Ma'lumotlari**
🏷 Nomi: ${field.name}
🆔 ID: ${field.id}
📢 Kanal ID: ${field.channelId}
🔗 Kanal linki: ${field.channelLink || "Yo'q"}
📅 Yaratilgan: ${field.createdAt.toLocaleDateString('uz-UZ')}
✅ Faol: ${field.isActive ? 'Ha' : "Yo'q"}
    `.trim();

    const keyboard = new InlineKeyboard()
      .text("🗑 O'chirish", `delete_field_${field.id}`)
      .row()
      .text('🔙 Orqaga', 'back_to_fields');

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
    await ctx.answerCallbackQuery();
  }

  private async backToFieldsList(ctx: BotContext) {
    await this.showFieldsList(ctx);
  }

  private async deleteField(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const fieldId = parseInt(ctx.match![1] as string);
    await this.fieldService.delete(fieldId);

    await ctx.answerCallbackQuery({ text: '✅ Field ochirildi' });
    await ctx.editMessageText('✅ Field muvaffaqiyatli ochirildi');
  }

  // ==================== CHANNEL MANAGEMENT ====================
  private async showMandatoryChannels(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const channels = await this.channelService.findAllMandatory();
    if (channels.length === 0) {
      const keyboard = new Keyboard()
        .text("➕ Majburiy kanal qo'shish")
        .row()
        .text('🔙 Orqaga')
        .resized();

      await ctx.reply("📢 Hech qanday majburiy kanal yo'q.", {
        reply_markup: keyboard,
      });
      return;
    }

    let message = '📢 Majburiy kanallar:\n\n';
    channels.forEach((ch, i) => {
      message += `${i + 1}. ${ch.channelName}\n`;
      message += `   Link: ${ch.channelLink}\n`;
      message += `   ID: ${ch.channelId}\n\n`;
    });

    const inlineKeyboard = new InlineKeyboard();
    channels.forEach((ch) => {
      inlineKeyboard
        .text(`🗑 ${ch.channelName}`, `delete_mandatory_${ch.id}`)
        .row();
    });

    await ctx.reply(message, { reply_markup: inlineKeyboard });

    const keyboard = new Keyboard()
      .text("➕ Majburiy kanal qo'shish")
      .row()
      .text('🔙 Orqaga')
      .resized();

    await ctx.reply("Yangi kanal qo'shish:", { reply_markup: keyboard });
  }

  private async startAddMandatoryChannel(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) return;

    await this.sessionService.startSession(
      Number(admin.telegramId),
      AdminState.ADD_MANDATORY_CHANNEL,
    );

    const keyboard = new Keyboard()
      .text('🌐 Public kanal')
      .text('🔒 Private kanal')
      .row()
      .text('🔗 Boshqa link')
      .row()
      .text('❌ Bekor qilish')
      .resized();

    await ctx.reply(
      '📝 Kanal turini tanlang:\n\n' +
        '🌐 Public kanal - Ochiq kanal (ID/username + link)\n' +
        '🔒 Private kanal - Yopiq kanal (ID + link)\n' +
        '🔗 Boshqa link - Instagram, YouTube va boshqalar\n\n' +
        "❌ Bekor qilish uchun 'Bekor qilish' tugmasini bosing",
      { reply_markup: keyboard },
    );
  }

  private async deleteMandatoryChannel(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const channelId = parseInt(ctx.match![1] as string);
    await this.channelService.delete(channelId);

    await ctx.answerCallbackQuery({ text: '✅ Majburiy kanal ochirildi' });
    await this.showMandatoryChannels(ctx);
  }

  private async showDatabaseChannels(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const channels = await this.channelService.findAllDatabase();
    if (channels.length === 0) {
      const keyboard = new Keyboard()
        .text("➕ Database kanal qo'shish")
        .row()
        .text('🔙 Orqaga')
        .resized();

      await ctx.reply("💾 Hech qanday database kanal yo'q.", {
        reply_markup: keyboard,
      });
      return;
    }

    let message = '💾 Database kanallar:\n\n';
    channels.forEach((ch, i) => {
      message += `${i + 1}. ${ch.channelName}\n`;
      message += `   ID: ${ch.channelId}\n\n`;
    });

    const inlineKeyboard = new InlineKeyboard();
    channels.forEach((ch) => {
      inlineKeyboard
        .text(`🗑 ${ch.channelName}`, `delete_db_channel_${ch.id}`)
        .row();
    });

    await ctx.reply(message, { reply_markup: inlineKeyboard });

    const keyboard = new Keyboard()
      .text("➕ Database kanal qo'shish")
      .row()
      .text('🔙 Orqaga')
      .resized();

    await ctx.reply("Yangi kanal qo'shish:", { reply_markup: keyboard });
  }

  private async startAddDatabaseChannel(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) return;

    await this.sessionService.startSession(
      Number(admin.telegramId),
      AdminState.ADD_DATABASE_CHANNEL,
    );

    const keyboard = new Keyboard().text('❌ Bekor qilish').resized();

    await ctx.reply(
      '📝 Database kanalning ID sini yuboring:\n\n' +
        'Masalan: -1001234567890\n\n' +
        "❌ Bekor qilish uchun 'Bekor qilish' tugmasini bosing",
      { reply_markup: keyboard },
    );
  }

  private async deleteDatabaseChannel(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const channelId = parseInt(ctx.match![1] as string);
    await this.channelService.deleteDatabaseChannel(channelId);

    await ctx.answerCallbackQuery({ text: '✅ Database kanal ochirildi' });
    await this.showDatabaseChannels(ctx);
  }

  // ==================== PAYMENT MANAGEMENT ====================
  private async showPaymentsMenu(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    await ctx.reply(
      "💳 To'lovlar bo'limi",
      AdminKeyboard.getPaymentManagementMenu(),
    );
  }

  private async showPendingPayments(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const payments = await this.paymentService.findPending();
    if (payments.length === 0) {
      await ctx.reply("📥 Yangi to'lovlar yo'q.");
      return;
    }

    for (const payment of payments) {
      const message = `
💳 **To'lov #${payment.id}**
👤 Foydalanuvchi: ${payment.user.firstName || 'N/A'}
💰 Summa: ${payment.amount} ${payment.currency}
📅 Davomiyligi: ${payment.duration} kun
🕐 Sana: ${payment.createdAt.toLocaleString('uz-UZ')}
      `;

      const keyboard = new InlineKeyboard()
        .text('✅ Tasdiqlash', `approve_payment_${payment.id}`)
        .text('❌ Rad etish', `reject_payment_${payment.id}`);

      await ctx.api.sendPhoto(ctx.chat!.id, payment.receiptFileId, {
        caption: message,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  }

  private async approvePayment(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const paymentId = parseInt(ctx.match![1] as string);
    const payment = await this.paymentService.findById(paymentId);

    await this.paymentService.approve(paymentId, admin.id, payment.duration);
    await ctx.answerCallbackQuery({ text: '✅ Tolov tasdiqlandi' });
    await ctx.editMessageCaption({
      caption: '✅ Tolov tasdiqlandi va premium berildi',
    });
  }

  private async rejectPayment(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const paymentId = parseInt(ctx.match![1] as string);
    await this.paymentService.reject(
      paymentId,
      admin.id,
      'Admin tomonidan rad etildi',
    );

    await ctx.answerCallbackQuery({ text: '❌ Tolov rad etildi' });
    await ctx.editMessageCaption({ caption: '❌ Tolov rad etildi' });
  }

  // ==================== ADMIN MANAGEMENT ====================
  private async showAdminsList(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || admin.role !== 'SUPERADMIN') {
      await ctx.reply("❌ Sizda admin boshqarish huquqi yo'q.");
      return;
    }

    const admins = await this.adminService.findAll();
    let message = '👥 Adminlar royxati:\n\n';
    admins.forEach((a, i) => {
      message += `${i + 1}. @${a.username || 'N/A'}\n`;
      message += `   Rol: ${a.role}\n`;
      message += `   ID: ${a.telegramId}\n\n`;
    });

    const keyboard = new InlineKeyboard();
    admins
      .filter((a) => a.role !== 'SUPERADMIN')
      .forEach((a) => {
        keyboard
          .text(
            `🗑 ${a.username || a.telegramId}`,
            `delete_admin_${a.telegramId}`,
          )
          .row();
      });
    keyboard.text("➕ Admin qo'shish", 'add_new_admin');

    await ctx.reply(message, { reply_markup: keyboard });
  }

  private async startAddingAdmin(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || admin.role !== 'SUPERADMIN') {
      await ctx.answerCallbackQuery({
        text: "❌ Sizda admin qo'shish huquqi yo'q.",
      });
      return;
    }

    if (!ctx.from) return;

    await this.sessionService.startSession(ctx.from.id, AdminState.ADD_ADMIN);

    const keyboard = new Keyboard().text('❌ Bekor qilish').resized();

    await ctx.reply(
      '📝 Yangi admin Telegram ID sini yuboring:\n\n' +
        'Masalan: 123456789\n\n' +
        "❌ Bekor qilish uchun 'Bekor qilish' tugmasini bosing",
      { reply_markup: keyboard },
    );
    await ctx.answerCallbackQuery();
  }

  private async deleteAdmin(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || admin.role !== 'SUPERADMIN') {
      await ctx.answerCallbackQuery({
        text: "❌ Sizda admin o'chirish huquqi yo'q.",
      });
      return;
    }

    const adminTelegramId = ctx.match![1] as string;
    await this.adminService.deleteAdmin(adminTelegramId);

    await ctx.answerCallbackQuery({ text: '✅ Admin ochirildi' });
    await this.showAdminsList(ctx);
  }

  // ==================== SETTINGS ====================
  private async showSettings(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || admin.role !== 'SUPERADMIN') {
      await ctx.reply("❌ Sizda sozlamalarni o'zgartirish huquqi yo'q.");
      return;
    }

    const premiumSettings = await this.premiumService.getSettings();
    const botSettings = await this.settingsService.getSettings();

    const message = `
⚙️ **BOT SOZLAMALARI**

💎 **Premium narxlar:**
├ 1 oy: ${premiumSettings.monthlyPrice} ${premiumSettings.currency}
├ 3 oy: ${premiumSettings.threeMonthPrice} ${premiumSettings.currency}
├ 6 oy: ${premiumSettings.sixMonthPrice} ${premiumSettings.currency}
└ 1 yil: ${premiumSettings.yearlyPrice} ${premiumSettings.currency}

💳 **Karta ma'lumotlari:**
├ Raqam: ${premiumSettings.cardNumber}
└ Egasi: ${premiumSettings.cardHolder}

📱 **Bot ma'lumotlari:**
├ Support: @${botSettings.supportUsername}
└ Admin chat: ${botSettings.adminNotificationChat}
    `;

    const keyboard = new InlineKeyboard()
      .text("💰 Narxlarni o'zgartirish", 'edit_prices')
      .row()
      .text("💳 Karta ma'lumotlarini o'zgartirish", 'edit_card')
      .row()
      .text('🔙 Orqaga', 'back_to_admin_menu');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async startEditingPrices(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || admin.role !== 'SUPERADMIN') {
      await ctx.answerCallbackQuery({ text: "❌ Ruxsat yo'q" });
      return;
    }

    if (!ctx.from) return;

    await this.sessionService.startSession(
      ctx.from.id,
      AdminState.EDIT_PREMIUM_PRICES,
    );

    const keyboard = new Keyboard().text('❌ Bekor qilish').resized();

    await ctx.reply(
      "💰 1 oylik premium narxini kiriting (so'mda):\n\n" +
        'Masalan: 25000\n\n' +
        "❌ Bekor qilish uchun 'Bekor qilish' tugmasini bosing",
      { reply_markup: keyboard },
    );
    await ctx.answerCallbackQuery();
  }

  private async startEditingCard(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || admin.role !== 'SUPERADMIN') {
      await ctx.answerCallbackQuery({ text: "❌ Ruxsat yo'q" });
      return;
    }

    if (!ctx.from) return;

    await this.sessionService.startSession(
      ctx.from.id,
      AdminState.EDIT_CARD_INFO,
    );

    const keyboard = new Keyboard().text('❌ Bekor qilish').resized();

    await ctx.reply(
      '💳 Yangi karta raqamini kiriting:\n\n' +
        'Masalan: 8600 1234 5678 9012\n\n' +
        "❌ Bekor qilish uchun 'Bekor qilish' tugmasini bosing",
      { reply_markup: keyboard },
    );
    await ctx.answerCallbackQuery();
  }

  private async backToAdminMenu(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    await ctx.editMessageText('🏠 Asosiy menyu');
    await ctx.reply(
      '👨‍💼 Admin panel',
      AdminKeyboard.getAdminMainMenu(admin.role),
    );
  }

  // ==================== BROADCAST ====================
  private async startBroadcast(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin || admin.role !== 'SUPERADMIN') {
      await ctx.reply("❌ Sizda reklama yuborish huquqi yo'q.");
      return;
    }

    const message = `
📣 **Reklama yuborish**

Qaysi guruhga xabar yubormoqchisiz?
    `.trim();

    const keyboard = new InlineKeyboard()
      .text('📢 Hammaga', 'broadcast_all')
      .row()
      .text('💎 Faqat Premium', 'broadcast_premium')
      .text('🆓 Faqat Oddiy', 'broadcast_free')
      .row()
      .text('🔙 Orqaga', 'back_to_admin_menu');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private async handleBroadcastType(ctx: BotContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery) || !ctx.from)
      return;

    const broadcastType = ctx.callbackQuery.data
      .replace('broadcast_', '')
      .toUpperCase();
    await ctx.answerCallbackQuery();

    // Start broadcast session
    this.sessionService.startSession(ctx.from.id, 'BROADCASTING' as any);
    this.sessionService.updateSessionData(ctx.from.id, { broadcastType });

    const keyboard = new Keyboard().text('❌ Bekor qilish').resized();

    await ctx.reply(
      "📝 Yubormoqchi bo'lgan xabaringizni yuboring:\n\n" +
        "(Matn, rasm yoki video bo'lishi mumkin)",
      { reply_markup: keyboard },
    );
  }

  // ==================== WEB PANEL ====================
  private async showWebPanel(ctx: BotContext) {
    const admin = await this.getAdmin(ctx);
    if (!admin) {
      this.logger.warn(`[showWebPanel] User ${ctx.from?.id} is not an admin`);
      await ctx.reply('❌ Siz admin emassiz!');
      return;
    }

    try {
      this.logger.log(
        `[showWebPanel] Admin ${admin.telegramId} requesting web panel link`,
      );

      // Use WEB_PANEL_URL from env or construct from PORT
      const webPanelUrl =
        process.env.WEB_PANEL_URL ||
        `http://localhost:${process.env.PORT || 3001}`;
      const adminPanelUrl = `${webPanelUrl}/admin?token=${admin.telegramId}`;

      this.logger.log(`[showWebPanel] Generated URL: ${adminPanelUrl}`);

      const keyboard = new InlineKeyboard().url(
        "🌐 Admin Panelga o'tish",
        adminPanelUrl,
      );
      await ctx.reply(
        `🌐 Web Admin Panel\n\n` +
          `👤 Admin: ${admin.username || admin.telegramId}\n` +
          `🔐 Rol: ${admin.role}\n\n` +
          `Quyidagi tugmani bosib admin panelga o'ting:`,
        {
          reply_markup: keyboard,
        },
      );

      this.logger.log(
        `[showWebPanel] Web panel link sent successfully to ${admin.telegramId}`,
      );
    } catch (error) {
      this.logger.error('Error showing web panel:', error);
      this.logger.error('Error stack:', error?.stack);
      this.logger.error('Error message:', error?.message);
      await ctx.reply('❌ Web panel linkini yaratishda xatolik yuz berdi.');
    }
  }

  // ==================== SESSION TEXT HANDLERS ====================
  private async handleFieldCreationSteps(
    ctx: BotContext,
    text: string,
    session: any,
  ) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) return;

    switch (session.step) {
      case 0: // Field name
        this.sessionService.updateSessionData(ctx.from.id, { name: text });
        this.sessionService.nextStep(ctx.from.id);
        await ctx.reply(
          '📝 Kanal ID sini yuboring:\n\nMasalan: -1001234567890',
          AdminKeyboard.getCancelButton(),
        );
        break;

      case 1: // Channel ID
        const channelId = text.trim();
        if (!channelId.startsWith('-')) {
          await ctx.reply(
            "❌ Kanal ID noto'g'ri formatda!\n\nKanal ID '-' belgisi bilan boshlanishi kerak.\nMasalan: -1001234567890",
            AdminKeyboard.getCancelButton(),
          );
          return;
        }

        this.sessionService.updateSessionData(ctx.from.id, { channelId });
        this.sessionService.nextStep(ctx.from.id);
        await ctx.reply(
          '🔗 Kanal linkini yuboring:\n\nMasalan: https://t.me/+abcd1234',
          AdminKeyboard.getCancelButton(),
        );
        break;

      case 2: // Channel link
        const channelLink = text.trim();
        const data = session.data;

        try {
          await this.fieldService.create({
            name: data.name,
            channelId: data.channelId,
            channelLink,
          });

          this.sessionService.clearSession(ctx.from.id);
          await ctx.reply(
            '✅ Field muvaffaqiyatli yaratildi!',
            AdminKeyboard.getAdminMainMenu(admin.role),
          );
        } catch (error) {
          this.logger.error('Failed to create field', error);
          await ctx.reply(
            "❌ Field yaratishda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.",
            AdminKeyboard.getAdminMainMenu(admin.role),
          );
          this.sessionService.clearSession(ctx.from.id);
        }
        break;
    }
  }

  private async handleDatabaseChannelCreationSteps(
    ctx: BotContext,
    text: string,
    session: any,
  ) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) return;

    switch (session.step) {
      case 0: // Channel ID
        const channelId = text.trim();
        if (!channelId.startsWith('-')) {
          await ctx.reply(
            "❌ Kanal ID noto'g'ri formatda!\n\nKanal ID '-' belgisi bilan boshlanishi kerak.\nMasalan: -1001234567890",
            AdminKeyboard.getCancelButton(),
          );
          return;
        }

        // Try to get channel info
        try {
          const chat = await ctx.api.getChat(channelId);
          const channelName = 'title' in chat ? chat.title : channelId;

          await this.channelService.createDatabaseChannel({
            channelId,
            channelName,
            isActive: true,
          });

          this.sessionService.clearSession(ctx.from.id);
          await ctx.reply(
            `✅ Database kanal muvaffaqiyatli qo'shildi!\n\n📢 ${channelName}\n🆔 ${channelId}`,
            AdminKeyboard.getAdminMainMenu(admin.role),
          );
        } catch (error) {
          this.logger.error(
            'Failed to get channel info or create channel',
            error,
          );
          await ctx.reply(
            "❌ Kanal ma'lumotlarini olishda xatolik yuz berdi.\n\nBotning kanalda admin ekanligiga ishonch hosil qiling va qaytadan urinib ko'ring.",
            AdminKeyboard.getCancelButton(),
          );
        }
        break;
    }
  }

  private async handleMandatoryChannelCreationSteps(
    ctx: BotContext,
    text: string,
    session: any,
  ) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) return;

    switch (session.step) {
      case 0: // Channel type selection
        let channelType: 'PUBLIC' | 'PRIVATE' | 'EXTERNAL';

        if (text === '🌐 Public kanal') {
          channelType = 'PUBLIC';
          this.sessionService.updateSessionData(ctx.from.id, { channelType });
          this.sessionService.nextStep(ctx.from.id);
          await ctx.reply(
            '🆔 Kanal ID sini yoki @username ni yuboring:\n\nMasalan:\n- -1001234567890 (ID)\n- @mychannel (username)',
            AdminKeyboard.getCancelButton(),
          );
        } else if (text === '🔒 Private kanal') {
          channelType = ChannelType.PRIVATE;
          this.sessionService.updateSessionData(ctx.from.id, { channelType });
          this.sessionService.nextStep(ctx.from.id);
          await ctx.reply(
            "🆔 Kanal ID sini yuboring:\n\nKanal ID '-' belgisi bilan boshlanishi kerak.\nMasalan: -1001234567890",
            AdminKeyboard.getCancelButton(),
          );
        } else if (text === '🔗 Boshqa link') {
          channelType = ChannelType.EXTERNAL;
          this.sessionService.updateSessionData(ctx.from.id, { channelType });
          this.sessionService.nextStep(ctx.from.id);
          this.sessionService.nextStep(ctx.from.id); // Skip step 1
          await ctx.reply(
            '📝 Kanal/Guruh nomini kiriting:\n\nMasalan: Instagram Sahifa',
            AdminKeyboard.getCancelButton(),
          );
        }
        break;

      case 1: // Channel ID/Username (for PUBLIC/PRIVATE only)
        const channelIdOrUsername = text.trim();
        const data = session.data;

        if (data.channelType === ChannelType.PUBLIC) {
          // Validate public channel
          if (
            !channelIdOrUsername.startsWith('-') &&
            !channelIdOrUsername.startsWith('@')
          ) {
            await ctx.reply(
              "❌ Noto'g'ri format!\n\nKanal ID yoki username kiriting.\nMasalan: -1001234567890 yoki @mychannel",
              AdminKeyboard.getCancelButton(),
            );
            return;
          }
        } else if (data.channelType === ChannelType.PRIVATE) {
          // Validate private channel ID
          if (!channelIdOrUsername.startsWith('-')) {
            await ctx.reply(
              "❌ Kanal ID noto'g'ri formatda!\n\nKanal ID '-' belgisi bilan boshlanishi kerak.\nMasalan: -1001234567890",
              AdminKeyboard.getCancelButton(),
            );
            return;
          }
        }

        this.sessionService.updateSessionData(ctx.from.id, {
          channelId: channelIdOrUsername,
        });
        this.sessionService.nextStep(ctx.from.id);
        await ctx.reply(
          '🔗 Kanal linkini yuboring:\n\nMasalan: https://t.me/joinchat/abcd1234',
          AdminKeyboard.getCancelButton(),
        );
        break;

      case 2: // Channel name (EXTERNAL) or link (PUBLIC/PRIVATE)
        const input = text.trim();
        const sessionData = session.data;

        if (sessionData.channelType === ChannelType.EXTERNAL) {
          // For EXTERNAL, this is the channel name
          this.sessionService.updateSessionData(ctx.from.id, {
            channelName: input,
          });
          this.sessionService.nextStep(ctx.from.id);
          await ctx.reply(
            '🔗 Linkni yuboring:\n\nMasalan:\n- https://instagram.com/username\n- https://youtube.com/@channel',
            AdminKeyboard.getCancelButton(),
          );
        } else {
          // For PUBLIC/PRIVATE, this is the link
          const channelLink = input;

          try {
            // Get channel info
            const chat = await ctx.api.getChat(sessionData.channelId);
            const channelName =
              'title' in chat ? chat.title : sessionData.channelId;

            await this.channelService.createMandatoryChannel({
              channelId: sessionData.channelId,
              channelName,
              channelLink,
              type: sessionData.channelType,
              isActive: true,
            });

            this.sessionService.clearSession(ctx.from.id);
            await ctx.reply(
              `✅ Majburiy kanal muvaffaqiyatli qo'shildi!\n\n` +
                `📢 ${channelName}\n` +
                `🔗 ${channelLink}\n` +
                `📁 Turi: ${sessionData.channelType === 'PUBLIC' ? 'Public kanal' : 'Private kanal'}`,
              AdminKeyboard.getAdminMainMenu(admin.role),
            );
          } catch (error) {
            this.logger.error('Failed to create mandatory channel', error);
            await ctx.reply(
              "❌ Kanal qo'shishda xatolik yuz berdi.\n\nBotning kanalda admin ekanligiga ishonch hosil qiling va qaytadan urinib ko'ring.",
              AdminKeyboard.getCancelButton(),
            );
          }
        }
        break;

      case 3: // Link for EXTERNAL type
        const externalLink = text.trim();
        const extData = session.data;

        try {
          await this.channelService.createMandatoryChannel({
            channelName: extData.channelName,
            channelLink: externalLink,
            type: ChannelType.EXTERNAL,
            isActive: true,
          });

          this.sessionService.clearSession(ctx.from.id);
          await ctx.reply(
            `✅ Tashqi link muvaffaqiyatli qo'shildi!\n\n` +
              `📢 ${extData.channelName}\n` +
              `🔗 ${externalLink}\n` +
              `📁 Turi: Tashqi link`,
            AdminKeyboard.getAdminMainMenu(admin.role),
          );
        } catch (error) {
          this.logger.error('Failed to create external channel', error);
          await ctx.reply(
            "❌ Link qo'shishda xatolik yuz berdi.\n\nIltimos, qaytadan urinib ko'ring.",
            AdminKeyboard.getCancelButton(),
          );
        }
        break;
    }
  }

  private async handleAdminCreationSteps(
    ctx: BotContext,
    text: string,
    session: any,
  ) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) return;

    const telegramId = text.trim();

    try {
      // Check if user exists in Telegram
      const user = await ctx.api.getChat(telegramId);
      const username = 'username' in user ? user.username : undefined;

      await this.adminService.createAdmin({
        telegramId,
        username: username || telegramId,
        role: 'ADMIN',
        createdBy: admin.telegramId,
      });

      this.sessionService.clearSession(ctx.from.id);
      await ctx.reply(
        `✅ Admin muvaffaqiyatli qo'shildi!\n\n👤 ${username ? '@' + username : telegramId}\n🆔 ${telegramId}`,
        AdminKeyboard.getAdminMainMenu(admin.role),
      );
    } catch (error) {
      this.logger.error('Failed to create admin', error);
      await ctx.reply(
        "❌ Admin qo'shishda xatolik yuz berdi.\n\nIltimos, to'g'ri Telegram ID kiriting.",
        AdminKeyboard.getCancelButton(),
      );
    }
  }

  private async handlePriceEditingSteps(
    ctx: BotContext,
    text: string,
    session: any,
  ) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) return;

    const price = parseInt(text);
    if (isNaN(price) || price <= 0) {
      await ctx.reply(
        "❌ Narx noto'g'ri formatda!\n\nIltimos, faqat raqam kiriting.\nMasalan: 25000",
        AdminKeyboard.getCancelButton(),
      );
      return;
    }

    switch (session.step) {
      case 0: // Monthly price
        this.sessionService.updateSessionData(ctx.from.id, {
          monthlyPrice: price,
        });
        this.sessionService.nextStep(ctx.from.id);
        await ctx.reply(
          "💰 3 oylik premium narxini kiriting (so'mda):\n\nMasalan: 70000",
          AdminKeyboard.getCancelButton(),
        );
        break;

      case 1: // 3 months price
        this.sessionService.updateSessionData(ctx.from.id, {
          threeMonthPrice: price,
        });
        this.sessionService.nextStep(ctx.from.id);
        await ctx.reply(
          "💰 6 oylik premium narxini kiriting (so'mda):\n\nMasalan: 130000",
          AdminKeyboard.getCancelButton(),
        );
        break;

      case 2: // 6 months price
        this.sessionService.updateSessionData(ctx.from.id, {
          sixMonthPrice: price,
        });
        this.sessionService.nextStep(ctx.from.id);
        await ctx.reply(
          "💰 1 yillik premium narxini kiriting (so'mda):\n\nMasalan: 250000",
          AdminKeyboard.getCancelButton(),
        );
        break;

      case 3: // Yearly price
        const data = session.data;
        try {
          await this.premiumService.updatePrices({
            monthlyPrice: data.monthlyPrice,
            threeMonthPrice: data.threeMonthPrice,
            sixMonthPrice: data.sixMonthPrice,
            yearlyPrice: price,
          });

          this.sessionService.clearSession(ctx.from.id);
          await ctx.reply(
            '✅ Narxlar muvaffaqiyatli yangilandi!',
            AdminKeyboard.getAdminMainMenu(admin.role),
          );
        } catch (error) {
          this.logger.error('Failed to update prices', error);
          await ctx.reply(
            '❌ Narxlarni yangilashda xatolik yuz berdi.',
            AdminKeyboard.getAdminMainMenu(admin.role),
          );
          this.sessionService.clearSession(ctx.from.id);
        }
        break;
    }
  }

  private async handleCardEditingSteps(
    ctx: BotContext,
    text: string,
    session: any,
  ) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) return;

    switch (session.step) {
      case 0: // Card number
        this.sessionService.updateSessionData(ctx.from.id, {
          cardNumber: text.trim(),
        });
        this.sessionService.nextStep(ctx.from.id);
        await ctx.reply(
          '💳 Karta egasining ismini kiriting:\n\nMasalan: AZIZ KHAMIDOV',
          AdminKeyboard.getCancelButton(),
        );
        break;

      case 1: // Card holder
        const data = session.data;
        try {
          await this.premiumService.updateCardInfo({
            cardNumber: data.cardNumber,
            cardHolder: text.trim(),
          });

          this.sessionService.clearSession(ctx.from.id);
          await ctx.reply(
            "✅ Karta ma'lumotlari muvaffaqiyatli yangilandi!",
            AdminKeyboard.getAdminMainMenu(admin.role),
          );
        } catch (error) {
          this.logger.error('Failed to update card info', error);
          await ctx.reply(
            "❌ Karta ma'lumotlarini yangilashda xatolik yuz berdi.",
            AdminKeyboard.getAdminMainMenu(admin.role),
          );
          this.sessionService.clearSession(ctx.from.id);
        }
        break;
    }
  }

  private async handleSerialCreationSteps(
    ctx: BotContext,
    text: string,
    session: any,
  ) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) return;

    // Check if we're in episode uploading step
    if (session.step === 6) {
      // UPLOADING_EPISODES step (new serial)
      if (text.includes('qism yuklash') || text === '✅ Tugatish') {
        await this.serialManagementService.handleContinueOrFinish(ctx, text);
        return;
      } else if (text === '✅ Ha, field kanalga tashla') {
        await this.serialManagementService.finalizNewSerial(ctx, true);
        return;
      } else if (text === "❌ Yo'q, faqat saqlash") {
        await this.serialManagementService.finalizNewSerial(ctx, false);
        return;
      }
    }

    // Check if we're adding episodes to existing serial
    if (session.step === 7) {
      // ADDING_EPISODES step (existing serial)
      if (text.includes('qism yuklash') || text === '✅ Tugatish') {
        if (text === '✅ Tugatish') {
          // Ask about updating field channel
          const keyboard = new Keyboard()
            .text('✅ Ha, field kanalga yangilash')
            .row()
            .text("❌ Yo'q, faqat saqlash")
            .resized();

          await ctx.reply(
            '📺 Qismlar tayyorlandi!\n\nField kanaldagi posterni yangilashmi?',
            { reply_markup: keyboard },
          );
          return;
        } else {
          // Continue adding more episodes
          const data = session.data;
          await ctx.reply(
            `📹 ${data.nextEpisodeNumber}-qism videosini yuboring:`,
            AdminKeyboard.getCancelButton(),
          );
          return;
        }
      } else if (text === '✅ Ha, field kanalga yangilash') {
        await this.serialManagementService.finalizeAddingEpisodes(ctx, true);
        return;
      } else if (text === "❌ Yo'q, faqat saqlash") {
        await this.serialManagementService.finalizeAddingEpisodes(ctx, false);
        return;
      }
    }

    switch (session.step) {
      case SerialCreateStep.CODE:
        const code = parseInt(text);
        if (isNaN(code) || code <= 0) {
          await ctx.reply(
            "❌ Kod faqat raqamlardan iborat bo'lishi kerak!\nMasalan: 12345\n\nIltimos, qaytadan kiriting:",
            AdminKeyboard.getCancelButton(),
          );
          return;
        }

        // Check if code is available
        const existingSerial = await this.serialService.findByCode(
          code.toString(),
        );
        if (existingSerial) {
          this.sessionService.updateSessionData(ctx.from.id, {
            existingSerial,
            code,
            serial: existingSerial,
            nextEpisodeNumber: existingSerial.totalEpisodes + 1,
            addedEpisodes: [],
          });
          this.sessionService.setStep(ctx.from.id, 7); // Special step for adding episodes

          // Send serial poster with info
          const message = `
📺 **${existingSerial.title}**

${existingSerial.description || ''}

🎭 Janr: ${existingSerial.genre}
📊 Hozirda qismlari: ${existingSerial.totalEpisodes}
🆔 Kod: ${existingSerial.code}

📹 Keyingi qism (${existingSerial.totalEpisodes + 1}-qism) videosini yuboring:
          `.trim();

          await ctx.replyWithPhoto(existingSerial.posterFileId, {
            caption: message,
          });
          await ctx.reply(
            '📹 Videoni yuboring:',
            AdminKeyboard.getCancelButton(),
          );
          return;
        }

        this.sessionService.updateSessionData(ctx.from.id, { code });
        this.sessionService.setStep(ctx.from.id, SerialCreateStep.TITLE);
        await ctx.reply(
          'Serial nomini kiriting:\nMasalan: Game of Thrones',
          AdminKeyboard.getCancelButton(),
        );
        break;

      case SerialCreateStep.TITLE:
        if (text === "➕ Yangi qism qo'shish") {
          // Continue with existing serial
          const data = session.data;
          this.sessionService.updateSessionData(ctx.from.id, {
            isAddingEpisode: true,
            serialId: data.existingSerial.id,
            nextEpisode: data.existingSerial.totalEpisodes + 1,
          });

          await ctx.reply(
            `📹 Serial "${data.existingSerial.title}" uchun ${data.existingSerial.totalEpisodes + 1}-qism videosini yuboring:`,
            AdminKeyboard.getCancelButton(),
          );
          return;
        }

        this.sessionService.updateSessionData(ctx.from.id, { title: text });
        this.sessionService.setStep(ctx.from.id, SerialCreateStep.GENRE);
        await ctx.reply(
          '🎭 Janr kiriting:\nMasalan: Drama, Action',
          AdminKeyboard.getCancelButton(),
        );
        break;

      case SerialCreateStep.GENRE:
        this.sessionService.updateSessionData(ctx.from.id, { genre: text });
        this.sessionService.setStep(ctx.from.id, SerialCreateStep.DESCRIPTION);

        const keyboard = new Keyboard()
          .text('Next')
          .row()
          .text('❌ Bekor qilish')
          .resized();
        await ctx.reply(
          "📝 Tavsif kiriting:\n\n⏭ O'tkazib yuborish uchun 'Next' yozing",
          { reply_markup: keyboard },
        );
        break;

      case SerialCreateStep.DESCRIPTION:
        if (text.toLowerCase() === 'next') {
          this.sessionService.updateSessionData(ctx.from.id, {
            description: null,
          });
        } else {
          this.sessionService.updateSessionData(ctx.from.id, {
            description: text,
          });
        }
        this.sessionService.setStep(ctx.from.id, SerialCreateStep.FIELD);

        // Show fields list
        const allFields = await this.fieldService.findAll();
        if (allFields.length === 0) {
          await ctx.reply(
            '❌ Hech qanday field topilmadi. Avval field yarating.',
          );
          this.sessionService.clearSession(ctx.from.id);
          return;
        }

        let message = '📁 Qaysi fieldni tanlaysiz?\n\n';
        allFields.forEach((field, index) => {
          message += `${index + 1}. ${field.name}\n`;
        });
        message += '\nRaqamini kiriting (masalan: 1)';

        this.sessionService.updateSessionData(ctx.from.id, {
          fields: allFields,
        });
        await ctx.reply(message, AdminKeyboard.getCancelButton());
        break;

      case SerialCreateStep.FIELD:
        const fieldIndex = parseInt(text) - 1;
        const userFields = session.data.fields;

        if (
          isNaN(fieldIndex) ||
          fieldIndex < 0 ||
          fieldIndex >= userFields.length
        ) {
          await ctx.reply("❌ Noto'g'ri raqam. Iltimos qaytadan kiriting:");
          return;
        }

        this.sessionService.updateSessionData(ctx.from.id, {
          selectedField: userFields[fieldIndex],
          fieldId: userFields[fieldIndex].id,
        });
        this.sessionService.setStep(ctx.from.id, SerialCreateStep.PHOTO);

        await ctx.reply(
          '🖼 Serial rasmini (poster) yuboring:',
          AdminKeyboard.getCancelButton(),
        );
        break;
    }
  }

  private async handleVideoAttachmentSteps(
    ctx: BotContext,
    text: string,
    session: any,
  ) {
    const admin = await this.getAdmin(ctx);
    if (!admin || !ctx.from) return;

    const code = parseInt(text);
    if (isNaN(code) || code <= 0) {
      await ctx.reply(
        "❌ Kod faqat raqamlardan iborat bo'lishi kerak!\nMasalan: 12345\n\nIltimos, qaytadan kiriting:",
        AdminKeyboard.getCancelButton(),
      );
      return;
    }

    const movie = await this.movieService.findByCode(code.toString());
    if (!movie) {
      await ctx.reply(
        '❌ Bu kod bilan kino topilmadi!\n\nBoshqa kod kiriting:',
        AdminKeyboard.getCancelButton(),
      );
      return;
    }

    if (movie.videoFileId) {
      await ctx.reply(
        `❌ Bu kinoda allaqachon video bor!\n\n🎬 ${movie.title}\n\nBoshqa kod kiriting:`,
        AdminKeyboard.getCancelButton(),
      );
      return;
    }

    this.sessionService.updateSessionData(ctx.from.id, {
      movieId: movie.id,
      movieCode: code,
      movieTitle: movie.title,
    });
    this.sessionService.nextStep(ctx.from.id);

    await ctx.reply(
      `📹 "${movie.title}" kinosi uchun video yuboring:`,
      AdminKeyboard.getCancelButton(),
    );
  }

  private async handleBroadcastMessage(
    ctx: BotContext,
    text: string,
    session: any,
  ) {
    if (!ctx.from) return;

    const admin = await this.getAdmin(ctx);
    if (!admin) return;

    const broadcastType = session.data.broadcastType;
    const message = ctx.message;

    // Start broadcasting
    await ctx.reply('📤 Xabar yuborilmoqda... Iltimos kuting.');

    try {
      // Get users based on type
      let users;
      if (broadcastType === 'PREMIUM') {
        users = await this.premiumService.getPremiumUsers();
      } else if (broadcastType === 'FREE') {
        users = await this.userService.findAll();
        const premiumUsers = await this.premiumService.getPremiumUsers();
        const premiumIds = premiumUsers.map((u) => u.id);
        users = users.filter((u) => !premiumIds.includes(u.id));
      } else {
        // ALL
        users = await this.userService.findAll();
      }

      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          // Forward message to preserve "forward from" metadata
          if (message) {
            await ctx.api.copyMessage(
              user.telegramId,
              ctx.chat.id,
              message.message_id,
              { protect_content: false },
            );
          } else {
            // Fallback to sending text
            await ctx.api.sendMessage(user.telegramId, text);
          }
          successCount++;

          // Delay to avoid flood
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (error) {
          failCount++;
          this.logger.error(
            `Failed to send to user ${user.telegramId}:`,
            error,
          );
        }
      }

      this.sessionService.clearSession(ctx.from.id);

      await ctx.reply(
        `✅ Xabar yuborish yakunlandi!\n\n` +
          `📊 Jami: ${users.length}\n` +
          `✅ Yuborildi: ${successCount}\n` +
          `❌ Xato: ${failCount}`,
        AdminKeyboard.getAdminMainMenu(admin.role),
      );
    } catch (error) {
      this.logger.error('Broadcasting error:', error);
      await ctx.reply(
        '❌ Xabar yuborishda xatolik yuz berdi.',
        AdminKeyboard.getAdminMainMenu(admin.role),
      );
      this.sessionService.clearSession(ctx.from.id);
    }
  }
}
