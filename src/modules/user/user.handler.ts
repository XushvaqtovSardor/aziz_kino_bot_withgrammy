import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BotContext } from '../../bot/bot.context';
import { InlineKeyboard, Keyboard } from 'grammy';
import { UserService } from './services/user.service';
import { MovieService } from '../content/services/movie.service';
import { SerialService } from '../content/services/serial.service';
import { EpisodeService } from '../content/services/episode.service';
import { MovieEpisodeService } from '../content/services/movie-episode.service';
import { ChannelService } from '../channel/services/channel.service';
import { PremiumService } from '../payment/services/premium.service';
import { PaymentService } from '../payment/services/payment.service';
import { WatchHistoryService } from '../content/services/watch-history.service';
import { LanguageService } from '../language/language.service';
import { FieldService } from '../field/services/field.service';
import { SettingsService } from '../settings/services/settings.service';
import { AdminService } from '../admin/services/admin.service';
import { GrammyBotService } from '../../common/grammy/grammy-bot.module';
import { PrismaService } from '../../prisma/prisma.service';
import { MainMenuKeyboard } from './keyboards/main-menu.keyboard';

@Injectable()
export class UserHandler implements OnModuleInit {
  private readonly logger = new Logger(UserHandler.name);

  constructor(
    private userService: UserService,
    private movieService: MovieService,
    private serialService: SerialService,
    private episodeService: EpisodeService,
    private movieEpisodeService: MovieEpisodeService,
    private channelService: ChannelService,
    private premiumService: PremiumService,
    private paymentService: PaymentService,
    private watchHistoryService: WatchHistoryService,
    private languageService: LanguageService,
    private fieldService: FieldService,
    private settingsService: SettingsService,
    private adminService: AdminService,
    private grammyBot: GrammyBotService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registerHandlers();
    this.logger.log('User handlers registered with Grammy');
  }

  private registerHandlers() {
    const bot = this.grammyBot.bot;

    // Start command
    bot.command('start', this.handleStart.bind(this));

    // Main menu buttons
    bot.hears("🔍 Kino kodi bo'yicha qidirish", this.handleSearch.bind(this));
    bot.hears('💎 Premium sotib olish', this.showPremium.bind(this));
    bot.hears('ℹ️ Bot haqida', this.showAbout.bind(this));
    bot.hears('📞 Aloqa', this.showContact.bind(this));

    // Callback query handlers
    bot.callbackQuery(/^movie_\d+$/, this.handleMovieCallback.bind(this));
    bot.callbackQuery(/^serial_\d+$/, this.handleSerialCallback.bind(this));
    bot.callbackQuery(
      /^episode_(\d+)_(\d+)$/,
      this.handleEpisodeCallback.bind(this),
    );
    bot.callbackQuery(
      /^movie_episode_(\d+)_(\d+)$/,
      this.handleMovieEpisodeCallback.bind(this),
    );
    bot.callbackQuery(
      /^field_channel_(\d+)$/,
      this.handleFieldChannelCallback.bind(this),
    );
    bot.callbackQuery(
      /^check_subscription$/,
      this.handleCheckSubscription.bind(this),
    );
    bot.callbackQuery(/^show_premium$/, this.showPremium.bind(this));
    bot.callbackQuery(
      /^buy_premium_(\d+)$/,
      this.handlePremiumPurchase.bind(this),
    );
    bot.callbackQuery(/^upload_receipt$/, this.handleUploadReceipt.bind(this));
    bot.callbackQuery(/^share_movie_(\d+)$/, this.handleShareMovie.bind(this));
    bot.callbackQuery(
      /^share_serial_(\d+)$/,
      this.handleShareSerial.bind(this),
    );

    // Inline query handler for sharing
    bot.on('inline_query', this.handleInlineQuery.bind(this));

    // Handle chat join requests (for private channels)
    bot.on('chat_join_request', this.handleJoinRequest.bind(this));

    // Handle photo messages (for receipt upload)
    bot.on('message:photo', this.handlePhotoMessage.bind(this));

    // NOTE: message:text is handled by admin.handler.ts middleware first
    // If admin has no session, it calls next() which then triggers bot.use()
    // We register handleTextMessage via bot.use() to be called after admin middleware
    bot.use(async (ctx, next) => {
      if (ctx.message && 'text' in ctx.message) {
        await this.handleTextMessage(ctx);
        return;
      } else {
        await next();
      }
    });
  }

  // ==================== START COMMAND ====================
  private async handleStart(ctx: BotContext) {
    if (!ctx.from) return;

    const payload = ctx.match;
    this.logger.log(`User ${ctx.from.id} started bot with payload: ${payload}`);

    // Check Telegram Premium status
    const hasTelegramPremium = ctx.from.is_premium || false;

    // Check or create user
    const user = await this.userService.findOrCreate(String(ctx.from.id), {
      firstName: ctx.from.first_name || '',
      lastName: ctx.from.last_name || '',
      username: ctx.from.username || '',
      languageCode: ctx.from.language_code || 'uz',
    });

    // Check if user is blocked
    if (user.isBlocked) {
      await ctx.reply(
        '🚫 Siz botdan foydalanish huquqidan mahrum etilgansiz.\n\n' +
          `Sabab: ${user.blockReason || 'Admin tomonidan bloklangan'}\n` +
          `Sana: ${user.blockedAt?.toLocaleString('uz-UZ') || "Noma'lum"}`,
      );
      return;
    }

    // Update Telegram Premium status in database
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hasTelegramPremium },
    });

    // Check premium status
    const premiumStatus = await this.premiumService.checkPremiumStatus(user.id);
    const isPremium = premiumStatus.isPremium && !premiumStatus.isExpired;

    // Check if user is admin/manager/superadmin
    const admin = await this.adminService.getAdminByTelegramId(
      String(ctx.from.id),
    );
    const isAdmin = !!admin; // If admin exists, skip channel check

    // Check mandatory channels subscription FIRST (for all users, new and old)
    // Skip check for admins, managers, and superadmins
    if (!isPremium && !isAdmin) {
      const hasSubscription = await this.checkSubscription(ctx, 0, 'start');
      if (!hasSubscription) return; // Will show mandatory channels
    }

    // Handle deep link (start=123 for movie or start=s123 for serial)
    if (typeof payload === 'string' && payload.length > 0) {
      // Check if it's a serial (starts with 's')
      if (payload.startsWith('s')) {
        const code = parseInt(payload.substring(1));
        if (!isNaN(code)) {
          await this.sendSerialToUser(ctx, code);
          return;
        }
      } else {
        // It's a movie (just the code number)
        const code = parseInt(payload);
        if (!isNaN(code)) {
          await this.sendMovieToUser(ctx, code);
          return;
        }
      }
    }

    // Show welcome message
    const welcomeMessage =
      `👋 Assalomu alaykum, ${ctx.from.first_name} botimizga xush kelibsiz.

✍🏻 Kino kodini yuboring.`.trim();

    await ctx.reply(welcomeMessage, MainMenuKeyboard.getMainMenu(isPremium));
  }

  // ==================== MOVIES ====================
  private async showMovies(ctx: BotContext) {
    const fields = await this.fieldService.findAll();

    if (fields.length === 0) {
      await ctx.reply("❌ Hozircha kinolar yo'q.");
      return;
    }

    let message = "🎬 **Kino bo'limlari:**\n\n";
    message += "Qaysi bo'limdan kino ko'rmoqchisiz?\n";

    const keyboard = new InlineKeyboard();
    fields.forEach((field) => {
      keyboard.text(field.name, `field_${field.id}`).row();
    });

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  // ==================== SERIALS ====================
  private async showSerials(ctx: BotContext) {
    await ctx.reply("📺 Seriallar bo'limi ishlab chiqilmoqda...");
  }

  // ==================== SEARCH ====================
  private async handleSearch(ctx: BotContext) {
    await ctx.reply(
      '🔍 **Qidirish**\n\n' +
        'Kino yoki serial kodini kiriting:\n' +
        'Masalan: 12345',
      { parse_mode: 'Markdown' },
    );
  }

  // ==================== BOT HAQIDA ====================
  private async showAbout(ctx: BotContext) {
    const fields = await this.fieldService.findAll();

    if (fields.length === 0) {
      await ctx.reply(
        'ℹ️ **Bot haqida**\n\n' +
          'Bu bot orqali minglab kino va seriallarni tomosha qilishingiz mumkin.\n\n' +
          '🎬 Kino va seriallar har kuni yangilanadi\n' +
          '📱 Mobil va kompyuterda ishlaydi\n' +
          "💎 Premium obuna bilan reklama yo'q\n\n" +
          "❌ Hozircha field kanallar yo'q.",
        { parse_mode: 'Markdown' },
      );
      return;
    }

    let message = 'ℹ️ **Bot haqida**\n\n';
    message +=
      'Bu bot orqali minglab kino va seriallarni tomosha qilishingiz mumkin.\n\n';
    message += "📁 **Field kanallar ro'yxati:**\n\n";

    const keyboard = new InlineKeyboard();
    let buttonsInRow = 0;

    fields.forEach((field, index) => {
      message += `${index + 1}. ${field.name}\n`;
      keyboard.text(`${index + 1}`, `field_channel_${field.id}`);
      buttonsInRow++;

      if (buttonsInRow === 5) {
        keyboard.row();
        buttonsInRow = 0;
      }
    });

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  // ==================== FIELD KANALLARGA O'TISH ====================
  private async showFieldChannels(ctx: BotContext) {
    const fields = await this.fieldService.findAll();

    if (fields.length === 0) {
      await ctx.reply("❌ Hozircha field kanallar yo'q.");
      return;
    }

    let message = "📁 **Field kanallar ro'yxati:**\n\n";
    message += "Qaysi field kanaliga o'tmoqchisiz?\n\n";

    const keyboard = new InlineKeyboard();
    fields.forEach((field, index) => {
      message += `${index + 1}. ${field.name}\n`;
      keyboard.text(`${index + 1}`, `field_channel_${field.id}`);
      if ((index + 1) % 5 === 0) keyboard.row();
    });

    if (fields.length % 5 !== 0) keyboard.row();

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  // ==================== PROFILE ====================
  private async showProfile(ctx: BotContext) {
    if (!ctx.from) return;

    const user = await this.userService.findByTelegramId(String(ctx.from.id));
    if (!user) {
      await ctx.reply('❌ Foydalanuvchi topilmadi.');
      return;
    }

    const premiumStatus = await this.premiumService.checkPremiumStatus(user.id);
    const watchHistory = await this.watchHistoryService.getUserHistory(
      user.id,
      100,
    );

    let message = `👤 **Profil**\n\n`;
    message += `📝 Ism: ${user.firstName}\n`;
    message += `🆔 ID: ${user.telegramId}\n`;
    message += `📅 Ro'yxatdan o'tgan: ${new Date(user.createdAt).toLocaleDateString()}\n`;
    message += `🎬 Ko'rilgan: ${watchHistory.length}\n\n`;

    if (
      premiumStatus.isPremium &&
      !premiumStatus.isExpired &&
      premiumStatus.expiresAt
    ) {
      const endDate = new Date(premiumStatus.expiresAt);
      message += `💎 Premium: Faol\n`;
      message += `📅 Tugash sanasi: ${endDate.toLocaleDateString()}\n`;
    } else {
      message += `❌ Premium: Yo'q\n`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  // ==================== PREMIUM ====================
  private async showPremium(ctx: BotContext) {
    // Handle callback query if it exists
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }

    const premiumSettings = await this.premiumService.getSettings();

    const message = `
💎 **Premium obuna**

Premium bilan:
✅ Reklama yo'q
✅ Majburiy kanallarga obuna bo'lmasdan tomosha qiling
✅ Barcha kinolar ochiq
✅ Yangi kinolar birinchi bo'lib

💰 **Narxlar:**
├ 1 oy: ${premiumSettings.monthlyPrice.toLocaleString()} ${premiumSettings.currency}
├ 3 oy: ${premiumSettings.threeMonthPrice.toLocaleString()} ${premiumSettings.currency}
├ 6 oy: ${premiumSettings.sixMonthPrice.toLocaleString()} ${premiumSettings.currency}
└ 1 yil: ${premiumSettings.yearlyPrice.toLocaleString()} ${premiumSettings.currency}

Qaysi muddatga obuna bo'lmoqchisiz?
    `.trim();

    const keyboard = new InlineKeyboard()
      .text('1 oy', 'buy_premium_1')
      .text('3 oy', 'buy_premium_3')
      .row()
      .text('6 oy', 'buy_premium_6')
      .text('1 yil', 'buy_premium_12');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  }

  private async handlePremiumPurchase(ctx: BotContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const months = parseInt(ctx.callbackQuery.data.replace('buy_premium_', ''));
    await ctx.answerCallbackQuery();

    const premiumSettings = await this.premiumService.getSettings();
    let price = premiumSettings.monthlyPrice;
    let duration = 30;

    switch (months) {
      case 1:
        price = premiumSettings.monthlyPrice;
        duration = 30;
        break;
      case 3:
        price = premiumSettings.threeMonthPrice;
        duration = 90;
        break;
      case 6:
        price = premiumSettings.sixMonthPrice;
        duration = 180;
        break;
      case 12:
        price = premiumSettings.yearlyPrice;
        duration = 365;
        break;
    }

    // Generate Payme link
    const botUsername = (await ctx.api.getMe()).username;
    const paymeUrl = this.generatePaymeUrl(
      ctx.from.id,
      price,
      duration,
      botUsername,
    );

    const message = `
💳 **To'lov ma'lumotlari**

📦 Obuna: ${months} oy
💰 Summa: ${price.toLocaleString()} ${premiumSettings.currency}

📝 **To'lov usuli:**

1️⃣ **Payme orqali:**
Quyidagi tugmani bosib to'lovni amalga oshiring.

2️⃣ **Kartadan kartaga:**
💳 Karta: ${premiumSettings.cardNumber}
👤 Egasi: ${premiumSettings.cardHolder}

To'lov qilgandan keyin chekni botga yuboring.
    `.trim();

    const keyboard = new InlineKeyboard()
      .url("💳 Payme orqali to'lash", paymeUrl)
      .row()
      .text('📸 Chek yuborish', 'upload_receipt');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    // Store payment info for this user
    this.waitingForReceipt.set(ctx.from.id, {
      amount: price,
      duration,
      months,
    });
  }

  private async handleUploadReceipt(ctx: BotContext) {
    if (!ctx.callbackQuery || !ctx.from) return;

    await ctx.answerCallbackQuery();

    await ctx.reply(
      '📸 **Chekni yuborish**\n\n' +
        "To'lov chekini rasm sifatida yuboring.\n\n" +
        "💡 Chek aniq va tushunarli bo'lishi kerak.",
      { parse_mode: 'Markdown' },
    );
  }

  private async handlePhotoMessage(ctx: BotContext) {
    if (!ctx.from || !ctx.message || !('photo' in ctx.message)) return;

    const userId = ctx.from.id;

    // Check if user is waiting to upload receipt
    const paymentInfo = this.waitingForReceipt.get(userId);

    if (!paymentInfo) {
      // User is not in receipt upload mode
      return;
    }

    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;

      this.logger.log(`User ${userId} uploaded receipt: ${fileId}`);

      // Get user from database
      const user = await this.userService.findByTelegramId(String(userId));
      if (!user) {
        await ctx.reply('❌ Foydalanuvchi topilmadi.');
        return;
      }

      // Create payment record
      const payment = await this.paymentService.create(
        user.id,
        paymentInfo.amount,
        fileId,
        paymentInfo.duration,
      );

      // Remove from waiting list
      this.waitingForReceipt.delete(userId);

      // Send confirmation to user
      await ctx.reply(
        '✅ **Chek qabul qilindi!**\n\n' +
          `📝 To'lov ID: ${payment.id}\n` +
          `💰 Summa: ${paymentInfo.amount.toLocaleString()} UZS\n` +
          `⏱ Muddati: ${paymentInfo.months} oy\n\n` +
          "⏳ Chekingiz ko'rib chiqilmoqda. Tez orada javob beramiz!",
        { parse_mode: 'Markdown' },
      );

      // Send notification to admins
      await this.notifyAdminsNewPayment(payment, user, paymentInfo);
    } catch (error) {
      this.logger.error('Error processing receipt:', error);
      await ctx.reply(
        "❌ Chekni qayta ishlashda xatolik yuz berdi. Iltimos qayta urinib ko'ring.",
      );
    }
  }

  private async notifyAdminsNewPayment(
    payment: any,
    user: any,
    paymentInfo: { amount: number; duration: number; months: number },
  ) {
    try {
      // Get all admins from database
      const admins = await this.adminService.findAll();

      const message = `
🔔 **Yangi to'lov!**

👤 Foydalanuvchi: ${user.firstName}${user.lastName ? ' ' + user.lastName : ''}
🆔 Telegram ID: ${user.telegramId}
📝 Username: @${user.username || "yo'q"}

💰 Summa: ${paymentInfo.amount.toLocaleString()} UZS
⏱ Muddati: ${paymentInfo.months} oy (${paymentInfo.duration} kun)
🆔 Payment ID: ${payment.id}
      `.trim();

      const keyboard = new InlineKeyboard()
        .text('✅ Tasdiqlash', `approve_payment_${payment.id}`)
        .text('❌ Rad etish', `reject_payment_${payment.id}`);

      for (const admin of admins) {
        try {
          // Send receipt photo to admin
          await this.grammyBot.bot.api.sendPhoto(
            admin.telegramId,
            payment.receiptFileId,
            {
              caption: message,
              parse_mode: 'Markdown',
              reply_markup: keyboard,
            },
          );
        } catch (error) {
          this.logger.error(
            `Failed to notify admin ${admin.telegramId}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error notifying admins:', error);
    }
  }

  private generatePaymeUrl(
    userId: number,
    amount: number,
    duration: number,
    botUsername: string,
  ): string {
    // Payme merchant ID from environment
    const merchantId = process.env.PAYME_MERCHANT_ID || '';

    if (!merchantId) {
      this.logger.error('PAYME_MERCHANT_ID not configured in .env');
      return 'https://checkout.paycom.uz';
    }

    // Amount in tiyin (1 so'm = 100 tiyin)
    const amountInTiyin = amount * 100;

    // Transaction params
    const params = Buffer.from(
      JSON.stringify({
        merchant_id: merchantId,
        amount: amountInTiyin,
        account: {
          user_id: String(userId),
          duration: duration,
        },
        callback: `https://t.me/${botUsername}`,
        callback_timeout: 15,
      }),
    ).toString('base64');

    const paymeEndpoint =
      process.env.PAYME_ENDPOINT || 'https://checkout.paycom.uz';
    return `${paymeEndpoint}/${params}`;
  }

  // ==================== SETTINGS ====================
  private async showSettings(ctx: BotContext) {
    await ctx.reply("⚙️ Sozlamalar bo'limi ishlab chiqilmoqda...");
  }

  // ==================== CONTACT ====================
  private async showContact(ctx: BotContext) {
    const settings = await this.settingsService.getSettings();

    // Use custom contact message if set by admin, otherwise use default
    const message =
      settings.contactMessage ||
      `
📞 **Aloqa**

Savollaringiz bo'lsa murojaat qiling:
👤 Admin: ${settings.supportUsername || '@admin'}
    `.trim();

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  // ==================== TEXT MESSAGE HANDLER ====================
  private async handleTextMessage(ctx: BotContext) {
    if (!ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text;

    this.logger.log(
      `[handleTextMessage] Received text: "${text}" from user ${ctx.from?.id}`,
    );

    // Skip if it's a command or button text
    if (
      text.startsWith('/') ||
      text.includes('🔍') ||
      text.includes('💎') ||
      text.includes('ℹ️') ||
      text.includes('📞') ||
      text.includes('🎬') ||
      text.includes('📺')
    ) {
      this.logger.log(`[handleTextMessage] Skipping button/command text`);
      return;
    }

    // Try to parse as code
    const code = parseInt(text);
    if (!isNaN(code) && code > 0) {
      this.logger.log(
        `[handleTextMessage] Parsed as code: ${code}, calling handleCodeSearch`,
      );
      await this.handleCodeSearch(ctx, code);
      this.logger.log(
        `[handleTextMessage] handleCodeSearch completed for code: ${code}`,
      );
    }
  }

  // ==================== CODE SEARCH ====================
  private async handleCodeSearch(ctx: BotContext, code: number) {
    if (!ctx.from) return;

    this.logger.log(
      `[handleCodeSearch] User ${ctx.from.id} searching for code: ${code}`,
    );

    // Check if user exists and premium status
    const user = await this.userService.findByTelegramId(String(ctx.from.id));
    if (!user) {
      this.logger.error(`[handleCodeSearch] User not found: ${ctx.from.id}`);
      return;
    }

    const premiumStatus = await this.premiumService.checkPremiumStatus(user.id);
    const isPremium = premiumStatus.isPremium && !premiumStatus.isExpired;

    this.logger.log(
      `[handleCodeSearch] User ${ctx.from.id} premium status: ${isPremium}`,
    );

    // Check subscription first if not premium
    if (!isPremium) {
      const hasSubscription = await this.checkSubscription(ctx, code, 'search');
      if (!hasSubscription) {
        this.logger.log(
          `[handleCodeSearch] User ${ctx.from.id} not subscribed`,
        );
        return;
      }
    }

    // Try to find movie
    const movie = await this.movieService.findByCode(String(code));
    if (movie) {
      this.logger.log(
        `[handleCodeSearch] Found movie: ${movie.title} (${code})`,
      );
      await this.sendMovieToUser(ctx, code);
      return;
    }

    // Try to find serial
    const serial = await this.serialService.findByCode(String(code));
    if (serial) {
      this.logger.log(
        `[handleCodeSearch] Found serial: ${serial.title} (${code})`,
      );
      await this.sendSerialToUser(ctx, code);
      return;
    }

    this.logger.log(`[handleCodeSearch] Movie/serial not found: ${code}`);
    await ctx.reply(`❌ ${code} kodli kino yoki serial topilmadi.`);
  }

  // ==================== SEND MOVIE ====================
  private async sendMovieToUser(ctx: BotContext, code: number) {
    if (!ctx.from) return;

    try {
      const movie = await this.movieService.findByCode(String(code));
      if (!movie) {
        await ctx.reply(`❌ ${code} kodli kino topilmadi.`);
        return;
      }

      const user = await this.userService.findByTelegramId(String(ctx.from.id));
      if (!user) return;

      // Get movie episodes
      const episodes = await this.movieEpisodeService.findByMovieId(movie.id);

      const botUsername = (await ctx.api.getMe()).username;
      const field = await this.fieldService.findOne(movie.fieldId);

      // If movie has multiple episodes, show episode selection like serials
      if (episodes.length > 1) {
        const movieDeepLink = `https://t.me/${botUsername}?start=${movie.code}`;

        const caption = `
╭────────────────────
├‣  Kino nomi : ${movie.title}
├‣  Kino kodi: ${movie.code}
├‣  Qism: ${episodes.length}
├‣  Janrlari: ${movie.genre || "Noma'lum"}
├‣  Kanal: ${field?.channelLink || '@' + (field?.name || 'Kanal')}
╰────────────────────
▶️ Kinoning to'liq qismini @${botUsername} dan tomosha qilishingiz mumkin!
        `.trim();

        // Create keyboard with episode numbers
        const keyboard = new InlineKeyboard();
        episodes.forEach((episode, index) => {
          keyboard.text(
            `${episode.episodeNumber}`,
            `movie_episode_${movie.id}_${episode.episodeNumber}`,
          );
          if ((index + 1) % 5 === 0) keyboard.row();
        });
        if (episodes.length % 5 !== 0) keyboard.row();

        const shareLink = `https://t.me/share/url?url=${movieDeepLink}&text=🎬 ${encodeURIComponent(movie.title)}%0A%0A📊Parts: ${episodes.length}%0A📝 Kod: ${movie.code}%0A%0A👆 Kinoni tomosha qilish uchun bosing:`;
        keyboard.url('📤 Share qilish', shareLink);

        // Send poster with episodes
        await ctx.replyWithPhoto(movie.posterFileId, {
          caption,
          reply_markup: keyboard,
        });

        // Record watch history
        await this.watchHistoryService.recordMovieWatch(user.id, movie.id);
      } else {
        // Single episode movie - send video directly
        if (movie.videoFileId) {
          const shareLink = `https://t.me/share/url?url=https://t.me/${botUsername}?start=${movie.code}&text=🎬 ${encodeURIComponent(movie.title)}%0A%0A📝 Kod: ${movie.code}%0A%0A👆 Kinoni tomosha qilish uchun bosing:`;

          const movieDeepLink = `https://t.me/${botUsername}?start=${movie.code}`;
          const shareKeyboard = new InlineKeyboard()
            .url(`🎬 Kino kodi: ${movie.code}`, movieDeepLink)
            .row()
            .url('📤 Share qilish', shareLink);

          this.logger.warn(`sendMovieToUser CALLED for ${code}`);

          const videoCaption = `
╭────────────────────
├‣  Kino nomi : ${movie.title}
├‣  Kino kodi: ${movie.code}
├‣  Qism: 1
├‣  Janrlari: ${movie.genre || "Noma'lum"}
├‣  Kanal: ${field?.channelLink || '@' + (field?.name || 'Kanal')}
╰────────────────────
▶️ Kinoning to'liq qismini https://t.me/${botUsername} dan tomosha qilishingiz mumkin!
          `.trim();

          await ctx.replyWithVideo(movie.videoFileId, {
            caption: videoCaption,
            protect_content: true,
            reply_markup: shareKeyboard,
          });

          // Record watch history
          await this.watchHistoryService.recordMovieWatch(user.id, movie.id);
        } else {
          await ctx.reply("⏳ Video hali yuklanmagan. Tez orada qo'shiladi.");
        }
      }

      this.logger.log(`User ${ctx.from.id} watched movie ${code}`);
    } catch (error) {
      this.logger.error(`Error sending movie ${code}:`, error);
      this.logger.error(`Error stack:`, error.stack);
      await ctx.reply(
        "❌ Kino yuklashda xatolik yuz berdi. Iltimos admin bilan bog'laning.",
      );
    }
  }

  private async sendSerialToUser(ctx: BotContext, code: number) {
    if (!ctx.from) return;

    try {
      const serial = await this.serialService.findByCode(String(code));
      if (!serial) {
        await ctx.reply(`❌ ${code} kodli serial topilmadi.`);
        return;
      }

      const user = await this.userService.findByTelegramId(String(ctx.from.id));
      if (!user) return;

      // Get episodes
      const episodes = await this.episodeService.findBySerialId(serial.id);

      const botUsername = (await ctx.api.getMe()).username;
      const serialDeepLink = `https://t.me/${botUsername}?start=s${code}`;
      const field = await this.fieldService.findOne(serial.fieldId);

      const caption = `
╭────────────────────
├‣  Serial nomi : ${serial.title}
├‣  Serial kodi: s${serial.code}
├‣  Qism: ${episodes.length}
├‣  Janrlari: ${serial.genre || "Noma'lum"}
├‣  Kanal: ${field?.channelLink || '@' + (field?.name || 'Kanal')}
╰────────────────────
▶️ Serialning to'liq qismini @${botUsername} dan tomosha qilishingiz mumkin!
      `.trim();

      // Create keyboard with episode numbers
      const keyboard = new InlineKeyboard();
      episodes.forEach((episode, index) => {
        keyboard.text(
          `${episode.episodeNumber}`,
          `episode_${serial.id}_${episode.episodeNumber}`,
        );
        if ((index + 1) % 5 === 0) keyboard.row();
      });

      if (episodes.length % 5 !== 0) keyboard.row();

      // Add serial code button and share button
      keyboard
        .url(`📺 Serial kodi: ${serial.code}`, serialDeepLink)
        .row()
        .text('📤 Ulashish', `share_serial_${code}`);

      await ctx.replyWithPhoto(serial.posterFileId, {
        caption,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      this.logger.log(`User ${ctx.from.id} requested serial ${code}`);
    } catch (error) {
      this.logger.error(`Error sending serial ${code}:`, error);
      await ctx.reply(
        "❌ Serial yuklashda xatolik yuz berdi. Iltimos admin bilan bog'laning.",
      );
    }
  }

  // ==================== CHECK SUBSCRIPTION ====================
  private async checkSubscription(
    ctx: BotContext,
    contentCode?: number,
    contentType?: string,
  ): Promise<boolean> {
    if (!ctx.from) return false;

    const allChannels = await this.channelService.findAllMandatory();
    if (allChannels.length === 0) return true;

    // Get subscription status using new service method
    const status = await this.channelService.checkUserSubscriptionStatus(
      ctx.from.id,
      ctx.api,
      this.joinRequestCache,
    );

    this.logger.log(
      `User ${ctx.from.id} subscription check: ${status.subscribedCount}/${status.totalChannels} subscribed, ${status.unsubscribedCount} unsubscribed (${status.unsubscribedChannels.filter((ch) => ch.isExternal).length} external)`,
    );

    // Update member counts for subscribed channels
    for (const subscribed of status.subscribedChannels) {
      if (subscribed.isSubscribed) {
        await this.channelService.incrementMemberCount(subscribed.id);

        // Decrement pending requests for private channels
        if (subscribed.type === 'PRIVATE' && subscribed.hasPendingRequest) {
          await this.channelService.decrementPendingRequests(subscribed.id);
          // Remove from cache
          const cacheKey = `${ctx.from.id}_${subscribed.channelId}`;
          this.joinRequestCache.delete(cacheKey);
        }
      }
    }

    // If user can access bot (all telegram channels subscribed), allow access
    if (status.canAccessBot) {
      return true;
    }

    // Show ALL unsubscribed channels at once
    let message = `❌ Botdan foydalanish uchun quyidagi kanallarga obuna bo'lishingiz yoki so'rov yuborishingiz kerak:\n\n`;

    // Count telegram and external channels
    const telegramChannels = status.unsubscribedChannels.filter(
      (ch) => !ch.isExternal,
    );
    const externalChannels = status.unsubscribedChannels.filter(
      (ch) => ch.isExternal,
    );

    if (telegramChannels.length > 0) {
      message += `📱 <b>Telegram kanallar</b> (${telegramChannels.length}):\n`;
      telegramChannels.forEach((channel, index) => {
        const channelTypeEmoji =
          channel.type === 'PUBLIC'
            ? '🔓'
            : channel.type === 'PRIVATE'
              ? '🔐'
              : '🔒';
        message += `${index + 1}. ${channelTypeEmoji} ${channel.channelName}\n`;
      });
      message += '\n';
    }

    if (externalChannels.length > 0) {
      message += `🌐 <b>Tashqi sahifalar</b> (${externalChannels.length}):\n`;
      externalChannels.forEach((channel, index) => {
        message += `${index + 1}. 🔗 ${channel.channelName}\n`;
      });
      message += '\n';
    }

    message += `✅ Telegram kanallariga obuna bo'ling yoki qo'shilish so'rovini yuboring.\n`;
    message += `🌐 Tashqi sahifalarga obuna bo'lishingiz tavsiya etiladi (majburiy emas).\n\n`;
    message += `<blockquote>💎 Premium obuna sotib olib, kanallarga obuna bo'lmasdan foydalanishingiz mumkin.</blockquote>`;

    const keyboard = new InlineKeyboard();

    // Add all channel buttons
    status.unsubscribedChannels.forEach((channel) => {
      const emoji = channel.isExternal ? '🌐' : '📱';
      keyboard
        .url(`${emoji} ${channel.channelName}`, channel.channelLink)
        .row();
    });

    keyboard.text('✅ Tekshirish', 'check_subscription').row();
    keyboard.text('💎 Premium sotib olish', 'show_premium');

    // Add content code if provided
    if (contentCode && contentType) {
      message += `\n🎬 Kino kodi: <b>${contentCode}</b>`;
    }

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    return false;
  }

  private async handleCheckSubscription(ctx: BotContext) {
    if (!ctx.callbackQuery || !ctx.from) return;

    await ctx.answerCallbackQuery({ text: 'Tekshirilmoqda...' });

    // Use new service method to check subscription status
    const status = await this.channelService.checkUserSubscriptionStatus(
      ctx.from.id,
      ctx.api,
      this.joinRequestCache,
    );

    this.logger.log(
      `[CheckSubscription] User ${ctx.from.id}: ${status.subscribedCount}/${status.totalChannels} subscribed, ${status.unsubscribedCount} unsubscribed`,
    );

    // Update member counts for subscribed channels
    for (const subscribed of status.subscribedChannels) {
      if (subscribed.isSubscribed) {
        await this.channelService.incrementMemberCount(subscribed.id);

        if (subscribed.type === 'PRIVATE' && subscribed.hasPendingRequest) {
          await this.channelService.decrementPendingRequests(subscribed.id);
          const cacheKey = `${ctx.from.id}_${subscribed.channelId}`;
          this.joinRequestCache.delete(cacheKey);
        }
      }
    }

    // Check if user can access bot (all telegram channels subscribed)
    if (status.canAccessBot) {
      // Delete old message
      try {
        if (ctx.callbackQuery?.message) {
          await ctx.api.deleteMessage(
            ctx.callbackQuery.message.chat.id,
            ctx.callbackQuery.message.message_id,
          );
        }
      } catch (error) {
        this.logger.warn('Could not delete subscription message:', error);
      }

      // Check if any have pending requests
      const hasPending = status.subscribedChannels.some(
        (ch) => ch.hasPendingRequest,
      );

      if (hasPending) {
        await ctx.reply(
          "⏳ So'rovingiz qabul qilindi!\n\n🔍 Kino yoki serial kodini yuboring.",
          { reply_markup: { remove_keyboard: true } },
        );
      } else {
        await ctx.reply(
          "✅ Siz barcha Telegram kanallariga obuna bo'ldingiz!\n\n🎬 Endi botdan foydalanishingiz mumkin.\n\n🔍 Kino yoki serial kodini yuboring.",
          { reply_markup: { remove_keyboard: true } },
        );
      }
      return;
    }

    // Still have unsubscribed channels - update message with detailed info
    const telegramChannels = status.unsubscribedChannels.filter(
      (ch) => !ch.isExternal,
    );
    const externalChannels = status.unsubscribedChannels.filter(
      (ch) => ch.isExternal,
    );

    let message = `❌ Quyidagi kanallarga hali obuna bo'lmadingiz yoki so'rov yubormadingiz:\n\n`;

    if (telegramChannels.length > 0) {
      message += `📱 <b>Telegram kanallar</b> (${telegramChannels.length}):\n`;
      telegramChannels.forEach((channel, index) => {
        const emoji =
          channel.type === 'PUBLIC'
            ? '🔓'
            : channel.type === 'PRIVATE'
              ? '🔐'
              : '🔒';
        const statusText =
          channel.status === 'left' ? "A'zo emas" : "So'rov yuborilmagan";
        message += `${index + 1}. ${emoji} ${channel.channelName} - ${statusText}\n`;
      });
      message += '\n';
    }

    if (externalChannels.length > 0) {
      message += `🌐 <b>Tashqi sahifalar</b> (${externalChannels.length}):\n`;
      externalChannels.forEach((channel, index) => {
        message += `${index + 1}. 🔗 ${channel.channelName}\n`;
      });
      message += '\n';
    }

    message +=
      "👆 Yuqoridagi Telegram kanallariga obuna bo'ling yoki so'rov yuboring va qayta tekshiring.";

    const keyboard = new InlineKeyboard();

    // Add all unsubscribed channel buttons
    status.unsubscribedChannels.forEach((channel) => {
      const emoji = channel.type === 'EXTERNAL' ? '🌐' : '📱';
      keyboard
        .url(`${emoji} ${channel.channelName}`, channel.channelLink)
        .row();
    });

    keyboard.text('✅ Tekshirish', 'check_subscription').row();
    keyboard.text('💎 Premium', 'show_premium');

    try {
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error updating subscription message:', error);
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }
  }

  // ==================== JOIN REQUEST HANDLER ====================
  // Store join requests in memory to prevent duplicates
  private joinRequestCache = new Map<string, number>();

  // Store users waiting to upload receipt
  private waitingForReceipt = new Map<
    number,
    { amount: number; duration: number; months: number }
  >();

  private async handleJoinRequest(ctx: BotContext) {
    if (!ctx.chatJoinRequest) return;

    const userId = ctx.chatJoinRequest.from.id;
    const chatId = String(ctx.chatJoinRequest.chat.id);
    const cacheKey = `${userId}_${chatId}`;

    this.logger.log(`Join request from user ${userId} to channel ${chatId}`);

    // Check if this user already sent a request to this channel recently (within 5 minutes)
    const lastRequestTime = this.joinRequestCache.get(cacheKey);
    const now = Date.now();

    if (lastRequestTime && now - lastRequestTime < 5 * 60 * 1000) {
      this.logger.log(
        `Duplicate join request from user ${userId} to channel ${chatId}, ignoring`,
      );
      return;
    }

    // Store this request
    this.joinRequestCache.set(cacheKey, now);

    // Clean up old entries (older than 10 minutes)
    for (const [key, time] of this.joinRequestCache.entries()) {
      if (now - time > 10 * 60 * 1000) {
        this.joinRequestCache.delete(key);
      }
    }

    // Find channel and increment pending requests
    const channel = await this.channelService.findAllMandatory();
    const matchedChannel = channel.find((ch) => ch.channelId === chatId);

    if (matchedChannel) {
      await this.channelService.incrementPendingRequests(matchedChannel.id);
      this.logger.log(
        `Incremented pending requests for channel ${matchedChannel.channelName}`,
      );
    }
  }

  // ==================== CALLBACK HANDLERS ====================
  private async handleMovieCallback(ctx: BotContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const code = parseInt(ctx.callbackQuery.data.replace('movie_', ''));
    await ctx.answerCallbackQuery();
    await this.sendMovieToUser(ctx, code);
  }

  private async handleSerialCallback(ctx: BotContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const code = parseInt(ctx.callbackQuery.data.replace('serial_', ''));
    await ctx.answerCallbackQuery();
    await this.sendSerialToUser(ctx, code);
  }

  private async handleEpisodeCallback(ctx: BotContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery) || !ctx.from)
      return;

    const match = ctx.callbackQuery.data.match(/^episode_(\d+)_(\d+)$/);
    if (!match) return;

    const serialId = parseInt(match[1]);
    const episodeNumber = parseInt(match[2]);

    await ctx.answerCallbackQuery({
      text: `${episodeNumber}-qism yuklanmoqda...`,
    });

    try {
      const episode = await this.episodeService.findBySerialIdAndNumber(
        serialId,
        episodeNumber,
      );
      if (!episode) {
        await ctx.reply('❌ Qism topilmadi.');
        return;
      }

      // Send episode video with share button
      const serial = await this.serialService.findById(serialId);
      const botUsername = (await ctx.api.getMe()).username;
      const field = await this.fieldService.findOne(serial.fieldId);
      const shareLink = `https://t.me/share/url?url=https://t.me/${botUsername}?start=s${serial.code}&text=📺 ${encodeURIComponent(serial.title)}\n\n📊 Qismlar: ${serial.totalEpisodes}\n📖 Kod: ${serial.code}\n\n👇 Serialni tomosha qilish uchun bosing:`;
      const serialDeepLink = `https://t.me/${botUsername}?start=s${serial.code}`;

      const shareKeyboard = new InlineKeyboard()
        .url(`📺 Serial kodi: ${serial.code}`, serialDeepLink)
        .row()
        .url('📤 Share qilish', shareLink);

      const videoCaption = `
╭────────────────────
├‣  Serial nomi : ${serial.title}
├‣  Serial kodi: s${serial.code}
├‣  Qism: ${episodeNumber}
├‣  Janrlari: ${serial.genre || "Noma'lum"}
├‣  Kanal: ${field?.channelLink || '@' + (field?.name || 'Kanal')}
╰────────────────────
▶️ Serialning to'liq qismini @${botUsername} dan tomosha qilishingiz mumkin!
      `.trim();

      if (episode.videoFileId) {
        await ctx.replyWithVideo(episode.videoFileId, {
          caption: videoCaption,
          protect_content: true,
          reply_markup: shareKeyboard,
        });
      } else if (episode.videoMessageId) {
        // Try to copy from channel
        try {
          const videoData = JSON.parse(episode.videoMessageId);
          if (Array.isArray(videoData) && videoData.length > 0) {
            await ctx.api.copyMessage(
              ctx.from.id,
              videoData[0].channelId,
              videoData[0].messageId,
              {
                protect_content: true,
                reply_markup: shareKeyboard,
              },
            );
          }
        } catch (error) {
          this.logger.error('Error copying episode video:', error);
          await ctx.reply('❌ Video yuklashda xatolik.');
        }
      }

      this.logger.log(
        `User ${ctx.from.id} watched episode ${episodeNumber} of serial ${serialId}`,
      );
    } catch (error) {
      this.logger.error('Error handling episode callback:', error);
      await ctx.reply('❌ Qism yuklashda xatolik yuz berdi.');
    }
  }

  private async handleMovieEpisodeCallback(ctx: BotContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery) || !ctx.from)
      return;

    const match = ctx.callbackQuery.data.match(/^movie_episode_(\d+)_(\d+)$/);
    if (!match) return;

    const movieId = parseInt(match[1]);
    const episodeNumber = parseInt(match[2]);

    await ctx.answerCallbackQuery({
      text: `${episodeNumber}-qism yuklanmoqda...`,
    });

    try {
      const episode = await this.movieEpisodeService.findByMovieIdAndNumber(
        movieId,
        episodeNumber,
      );
      if (!episode) {
        await ctx.reply('❌ Qism topilmadi.');
        return;
      }

      // Send episode video with share button
      const movie = await this.movieService.findById(movieId);
      const botUsername = (await ctx.api.getMe()).username;
      const field = await this.fieldService.findOne(movie.fieldId);
      const shareLink = `https://t.me/share/url?url=https://t.me/${botUsername}?start=${movie.code}&text=🎬 ${encodeURIComponent(movie.title)}\n\n📊 Qismlar: ${movie.totalEpisodes}\n📖 Kod: ${movie.code}\n\n👇 Kinoni tomosha qilish uchun bosing:`;
      const movieDeepLink = `https://t.me/${botUsername}?start=${movie.code}`;

      const shareKeyboard = new InlineKeyboard()
        .url(`🎬 Kino kodi: ${movie.code}`, movieDeepLink)
        .row()
        .url('📤 Share qilish', shareLink);

      const videoCaption = `
╭────────────────────
├‣  Kino nomi : ${movie.title}
├‣  Kino kodi: ${movie.code}
├‣  Qism: ${episodeNumber}
├‣  Janrlari: ${movie.genre || "Noma'lum"}
├‣  Kanal: ${field?.channelLink || '@' + (field?.name || 'Kanal')}
╰────────────────────
▶️ Kinoning to'liq qismini @${botUsername} dan tomosha qilishingiz mumkin!
      `.trim();

      if (episode.videoFileId) {
        await ctx.replyWithVideo(episode.videoFileId, {
          caption: videoCaption,
          protect_content: true,
          reply_markup: shareKeyboard,
        });
      } else if (episode.videoMessageId) {
        // Try to copy from channel
        try {
          const videoData = JSON.parse(episode.videoMessageId);
          if (Array.isArray(videoData) && videoData.length > 0) {
            await ctx.api.copyMessage(
              ctx.from.id,
              videoData[0].channelId,
              videoData[0].messageId,
              {
                protect_content: true,
                reply_markup: shareKeyboard,
              },
            );
          }
        } catch (error) {
          this.logger.error('Error copying movie episode video:', error);
          await ctx.reply('❌ Video yuklashda xatolik.');
        }
      }

      this.logger.log(
        `User ${ctx.from.id} watched episode ${episodeNumber} of movie ${movieId}`,
      );
    } catch (error) {
      this.logger.error('Error handling movie episode callback:', error);
      await ctx.reply('❌ Qism yuklashda xatolik yuz berdi.');
    }
  }

  private async handleFieldChannelCallback(ctx: BotContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const fieldId = parseInt(
      ctx.callbackQuery.data.replace('field_channel_', ''),
    );
    await ctx.answerCallbackQuery();

    try {
      const field = await this.fieldService.findOne(fieldId);
      if (!field) {
        await ctx.reply('❌ Field topilmadi.');
        return;
      }

      const keyboard = new InlineKeyboard().url(
        "📢 Kanalga o'tish",
        field.channelLink || `https://t.me/${field.channelId}`,
      );

      await ctx.reply(
        `📁 **${field.name}**\n\n` +
          `Kanalga o'ting va kino rasmlarini ko'ring.\n` +
          `Rasm tagidagi "Tomosha qilish" tugmasini bosing.`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        },
      );
    } catch (error) {
      this.logger.error('Error handling field channel callback:', error);
      await ctx.reply('❌ Xatolik yuz berdi.');
    }
  }

  private async handleShareMovie(ctx: BotContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const code = parseInt(ctx.callbackQuery.data.replace('share_movie_', ''));
    const botUsername = (await ctx.api.getMe()).username;
    const shareLink = `${code}`;

    await ctx.answerCallbackQuery({
      text: 'Pastdagi tugmani bosib ulashing!',
    });

    const keyboard = new InlineKeyboard().switchInline(
      '📤 Ulashish',
      shareLink,
    );

    await ctx.reply(
      '📤 **Kinoni ulashish**\n\n' +
        "Pastdagi tugmani bosing va o'zingiz xohlagan chatni tanlang:",
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      },
    );
  }

  private async handleShareSerial(ctx: BotContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const code = parseInt(ctx.callbackQuery.data.replace('share_serial_', ''));
    const botUsername = (await ctx.api.getMe()).username;
    const shareLink = `s${code}`;

    await ctx.answerCallbackQuery({
      text: 'Pastdagi tugmani bosib ulashing!',
    });

    const keyboard = new InlineKeyboard().switchInline(
      '📤 Ulashish',
      shareLink,
    );

    await ctx.reply(
      '📤 **Serialni ulashish**\n\n' +
        "Pastdagi tugmani bosing va o'zingiz xohlagan chatni tanlang:",
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      },
    );
  }

  // ==================== INLINE QUERY HANDLER ====================
  private async handleInlineQuery(ctx: BotContext) {
    if (!ctx.inlineQuery) return;

    const query = ctx.inlineQuery.query.trim();

    // Parse query: "123" for movie or "s123" for serial
    const serialMatch = query.match(/^s(\d+)$/i);
    const movieMatch = !serialMatch ? query.match(/^(\d+)$/) : null;

    const results: any[] = [];

    try {
      if (movieMatch) {
        const code = parseInt(movieMatch[1]);
        const movie = await this.movieService.findByCode(String(code));

        if (movie) {
          const botUsername = (await ctx.api.getMe()).username;
          const shareLink = `https://t.me/${botUsername}?start=${code}`;

          results.push({
            type: 'article',
            id: `movie_${code}`,
            title: `🎬 ${movie.title}`,
            description: movie.description || "Kinoni ko'rish",
            input_message_content: {
              message_text: `🎬 **${movie.title}**\n\n${movie.description || ''}\n\n🆔 Kod: ${code}\n\n👇 Ko'rish uchun pastdagi tugmani bosing:`,
              parse_mode: 'Markdown',
            },
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '▶️ Tomosha qilish',
                    url: shareLink,
                  },
                ],
              ],
            },
          });
        }
      }

      if (serialMatch) {
        const code = parseInt(serialMatch[1]);
        const serial = await this.serialService.findByCode(String(code));

        if (serial) {
          const botUsername = (await ctx.api.getMe()).username;
          const shareLink = `https://t.me/${botUsername}?start=s${code}`;

          results.push({
            type: 'article',
            id: `serial_${code}`,
            title: `📺 ${serial.title}`,
            description: serial.description || "Serialni ko'rish",
            input_message_content: {
              message_text: `📺 **${serial.title}**\n\n${serial.description || ''}\n\n📊 Qismlar: ${serial.totalEpisodes}\n🆔 Kod: ${code}\n\n👇 Ko'rish uchun pastdagi tugmani bosing:`,
              parse_mode: 'Markdown',
            },
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '▶️ Tomosha qilish',
                    url: shareLink,
                  },
                ],
              ],
            },
          });
        }
      }

      await ctx.answerInlineQuery(results, {
        cache_time: 300,
        is_personal: true,
      });
    } catch (error) {
      this.logger.error('Error handling inline query:', error);
      await ctx.answerInlineQuery([]);
    }
  }
}
