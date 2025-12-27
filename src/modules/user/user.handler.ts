import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BotContext } from '../../bot/bot.context';
import { InlineKeyboard, Keyboard } from 'grammy';
import { UserService } from './services/user.service';
import { MovieService } from '../content/services/movie.service';
import { SerialService } from '../content/services/serial.service';
import { EpisodeService } from '../content/services/episode.service';
import { ChannelService } from '../channel/services/channel.service';
import { PremiumService } from '../payment/services/premium.service';
import { WatchHistoryService } from '../content/services/watch-history.service';
import { LanguageService } from '../language/language.service';
import { FieldService } from '../field/services/field.service';
import { SettingsService } from '../settings/services/settings.service';
import { GrammyBotService } from '../../common/grammy/grammy-bot.module';
import { MainMenuKeyboard } from './keyboards/main-menu.keyboard';

@Injectable()
export class UserHandler implements OnModuleInit {
  private readonly logger = new Logger(UserHandler.name);

  constructor(
    private userService: UserService,
    private movieService: MovieService,
    private serialService: SerialService,
    private episodeService: EpisodeService,
    private channelService: ChannelService,
    private premiumService: PremiumService,
    private watchHistoryService: WatchHistoryService,
    private languageService: LanguageService,
    private fieldService: FieldService,
    private settingsService: SettingsService,
    private grammyBot: GrammyBotService,
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
    bot.hears("📁 Field kanallariga o'tish", this.showFieldChannels.bind(this));
    bot.hears('💎 Premium sotib olish', this.showPremium.bind(this));
    bot.hears('ℹ️ Bot haqida', this.showAbout.bind(this));
    bot.hears('👤 Profil', this.showProfile.bind(this));
    bot.hears('📞 Aloqa', this.showContact.bind(this));
    bot.hears('⚙️ Sozlamalar', this.showSettings.bind(this));

    // Callback query handlers
    bot.callbackQuery(/^movie_\d+$/, this.handleMovieCallback.bind(this));
    bot.callbackQuery(/^serial_\d+$/, this.handleSerialCallback.bind(this));
    bot.callbackQuery(
      /^episode_(\d+)_(\d+)$/,
      this.handleEpisodeCallback.bind(this),
    );
    bot.callbackQuery(
      /^field_channel_(\d+)$/,
      this.handleFieldChannelCallback.bind(this),
    );
    bot.callbackQuery(
      /^check_subscription$/,
      this.handleCheckSubscription.bind(this),
    );
    bot.callbackQuery(
      /^buy_premium_(\d+)$/,
      this.handlePremiumPurchase.bind(this),
    );
    bot.callbackQuery(/^share_movie_(\d+)$/, this.handleShareMovie.bind(this));
    bot.callbackQuery(
      /^share_serial_(\d+)$/,
      this.handleShareSerial.bind(this),
    );

    // Inline query handler for sharing
    bot.on('inline_query', this.handleInlineQuery.bind(this));

    // Handle text messages (for code search)
    bot.on('message:text', this.handleTextMessage.bind(this));
  }

  // ==================== START COMMAND ====================
  private async handleStart(ctx: BotContext) {
    if (!ctx.from) return;

    const payload = ctx.match;
    this.logger.log(`User ${ctx.from.id} started bot with payload: ${payload}`);

    // Check or create user
    const user = await this.userService.findOrCreate(String(ctx.from.id), {
      firstName: ctx.from.first_name || '',
      lastName: ctx.from.last_name || '',
      username: ctx.from.username || '',
      languageCode: ctx.from.language_code || 'uz',
    });

    // Check premium status
    const premiumStatus = await this.premiumService.checkPremiumStatus(user.id);
    const isPremium = premiumStatus.isPremium && !premiumStatus.isExpired;

    // Handle deep link (start=123 for movie or start=s123 for serial)
    if (typeof payload === 'string' && payload.length > 0) {
      // Check if it's a serial (starts with 's')
      if (payload.startsWith('s')) {
        const code = parseInt(payload.substring(1));
        if (!isNaN(code)) {
          // Check subscription first
          if (!isPremium) {
            const hasSubscription = await this.checkSubscription(
              ctx,
              code,
              'serial',
            );
            if (!hasSubscription) return;
          }
          await this.sendSerialToUser(ctx, code);
          return;
        }
      } else {
        // It's a movie (just the code number)
        const code = parseInt(payload);
        if (!isNaN(code)) {
          // Check subscription first
          if (!isPremium) {
            const hasSubscription = await this.checkSubscription(
              ctx,
              code,
              'movie',
            );
            if (!hasSubscription) return;
          }
          await this.sendMovieToUser(ctx, code);
          return;
        }
      }
    }

    // Show welcome message
    const settings = await this.settingsService.getSettings();
    const welcomeMessage =
      settings?.welcomeMessage ||
      `
👋 Xush kelibsiz, ${ctx.from.first_name}!

🎬 **Film botiga xush kelibsiz!**

Bu yerda minglab kino va seriallarni ko'rishingiz mumkin.

🔍 Kinoni topish uchun:
• Kino kodini yuboring (masalan: 12345)
• Yoki menyudan tanlov qiling
    `.trim();

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
    const settings = await this.settingsService.getSettings();

    const aboutText =
      settings?.aboutBot ||
      `
ℹ️ **Bot haqida**

Bu bot orqali minglab kino va seriallarni tomosha qilishingiz mumkin.

🎬 Kino va seriallar har kuni yangilanadi
📱 Mobil va kompyuterda ishlaydi
💎 Premium obuna bilan reklama yo'q

Botdan foydalanish uchun:
1. Kino kodini kiriting
2. Yoki field kanallariga o'ting
3. Kino rasmini bosing va "Tomosha qilish" tugmasini bosing

Savol va takliflar uchun:
📞 ${settings?.supportUsername || '@admin'}
    `.trim();

    await ctx.reply(aboutText, { parse_mode: 'Markdown' });
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

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
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
  }

  private generatePaymeUrl(
    userId: number,
    amount: number,
    duration: number,
    botUsername: string,
  ): string {
    // Payme merchant ID (sizning merchant ID'ingiz)
    const merchantId = process.env.PAYME_MERCHANT_ID || 'your_merchant_id';

    // Amount in tiyin (1 so'm = 100 tiyin)
    const amountInTiyin = amount * 100;

    // Transaction params
    const params = Buffer.from(
      JSON.stringify({
        merchant_id: merchantId,
        amount: amountInTiyin,
        account: {
          user_id: userId,
          duration: duration,
        },
        callback: `https://t.me/${botUsername}`,
        callback_timeout: 15,
      }),
    ).toString('base64');

    return `https://checkout.paycom.uz/${params}`;
  }

  // ==================== SETTINGS ====================
  private async showSettings(ctx: BotContext) {
    await ctx.reply("⚙️ Sozlamalar bo'limi ishlab chiqilmoqda...");
  }

  // ==================== CONTACT ====================
  private async showContact(ctx: BotContext) {
    const settings = await this.settingsService.getSettings();

    const message = `
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

    // Skip if it's a command or button
    if (text.startsWith('/') || text.includes('🎬') || text.includes('📺')) {
      return;
    }

    // Try to parse as code
    const code = parseInt(text);
    if (!isNaN(code) && code > 0) {
      await this.handleCodeSearch(ctx, code);
    }
  }

  // ==================== CODE SEARCH ====================
  private async handleCodeSearch(ctx: BotContext, code: number) {
    // Try to find movie
    const movie = await this.movieService.findByCode(String(code));
    if (movie) {
      await this.sendMovieToUser(ctx, code);
      return;
    }

    // Try to find serial
    const serial = await this.serialService.findByCode(String(code));
    if (serial) {
      await this.sendSerialToUser(ctx, code);
      return;
    }

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

      // Check premium
      const premiumStatus = await this.premiumService.checkPremiumStatus(
        user.id,
      );
      const isPremium = premiumStatus.isPremium && !premiumStatus.isExpired;

      // Check subscription if not premium
      if (!isPremium) {
        const isSubscribed = await this.checkSubscription(ctx, code, 'movie');
        if (!isSubscribed) {
          return;
        }
      }

      // Send video directly without poster
      const caption = `
🎬 **${movie.title}**
${movie.genre ? `🎭 Janr: ${movie.genre}\n` : ''}${movie.year ? `📅 Yil: ${movie.year}\n` : ''}${movie.imdb ? `⭐️ IMDB: ${movie.imdb}/10\n` : ''}
🆔 Kod: ${movie.code}
      `.trim();

      if (movie.videoFileId) {
        // Parse video messages if stored as JSON
        try {
          const videoData = JSON.parse(movie.videoMessageId || '[]');
          if (videoData.length > 0) {
            // Forward from database channel with share button
            const shareKeyboard = new InlineKeyboard().switchInline(
              '📤 Share qilish',
              `${movie.code}`,
            );

            for (const video of videoData) {
              await ctx.api.copyMessage(
                ctx.from.id,
                video.channelId,
                video.messageId,
                {
                  protect_content: true, // Disable forwarding
                  reply_markup: shareKeyboard,
                },
              );
            }
          }
        } catch (error) {
          // If not JSON, send directly with share button
          if (movie.videoFileId) {
            const shareKeyboard = new InlineKeyboard().switchInline(
              '📤 Share qilish',
              `${movie.code}`,
            );

            await ctx.replyWithVideo(movie.videoFileId, {
              caption: `🎬 ${movie.title}`,
              protect_content: true,
              reply_markup: shareKeyboard,
            });
          }
        }

        // Record watch history
        await this.watchHistoryService.recordMovieWatch(user.id, movie.id);
      } else {
        await ctx.reply("⏳ Video hali yuklanmagan. Tez orada qo'shiladi.");
      }

      this.logger.log(`User ${ctx.from.id} watched movie ${code}`);
    } catch (error) {
      this.logger.error(`Error sending movie ${code}:`, error);
      await ctx.reply(
        "❌ Kino yuklashda xatolik yuz berdi. Iltimos admin bilan bog'laning.",
      );
    }
  }

  // ==================== SEND SERIAL ====================
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

      // Check premium
      const premiumStatus = await this.premiumService.checkPremiumStatus(
        user.id,
      );
      const isPremium = premiumStatus.isPremium && !premiumStatus.isExpired;

      // Check subscription if not premium
      if (!isPremium) {
        const isSubscribed = await this.checkSubscription(ctx, code, 'serial');
        if (!isSubscribed) {
          return;
        }
      }

      // Get episodes
      const episodes = await this.episodeService.findBySerialId(serial.id);

      const botUsername = (await ctx.api.getMe()).username;
      const shareLink = `https://t.me/${botUsername}?start=serial_${code}`;

      const caption = `
📺 **${serial.title}**
${serial.genre ? `🎭 Janr: ${serial.genre}\n` : ''}${serial.description ? `\n📝 ${serial.description}\n` : ''}
📊 Jami qismlar: ${episodes.length}
🆔 Kod: ${serial.code}
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
      keyboard.text('📤 Ulashish', `share_serial_${code}`);

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

    const channels = await this.channelService.findAllMandatory();
    if (channels.length === 0) return true;

    const unsubscribedChannels = [];

    for (const channel of channels) {
      try {
        const member = await ctx.api.getChatMember(
          channel.channelId,
          ctx.from.id,
        );

        if (
          member.status !== 'member' &&
          member.status !== 'administrator' &&
          member.status !== 'creator'
        ) {
          unsubscribedChannels.push(channel);
        }
      } catch (error) {
        this.logger.error(
          `Error checking subscription for channel ${channel.channelName}:`,
          error,
        );
        unsubscribedChannels.push(channel);
      }
    }

    if (unsubscribedChannels.length > 0) {
      let message =
        "❌ **Botdan foydalanish uchun kanallarga obuna bo'ling:**\n\n";

      const keyboard = new InlineKeyboard();
      unsubscribedChannels.forEach((channel, index) => {
        message += `${index + 1}. ${channel.channelName}\n`;
        keyboard.url(channel.channelName, channel.channelLink).row();
      });

      keyboard.text('✅ Tekshirish', 'check_subscription');

      // Add premium purchase button
      keyboard.row();
      keyboard.text('💎 Premium sotib olish', 'show_premium');

      // Store content info for later if provided
      if (contentCode && contentType) {
        // You can store this in session/cache for retrieval after subscription
        message += `\n🎬 Kino kodi: ${contentCode}`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      return false;
    }

    return true;
  }

  private async handleCheckSubscription(ctx: BotContext) {
    if (!ctx.callbackQuery) return;

    await ctx.answerCallbackQuery({ text: 'Tekshirilmoqda...' });

    const isSubscribed = await this.checkSubscription(ctx);

    if (isSubscribed) {
      await ctx.editMessageText(
        "✅ Siz barcha kanallarga obuna bo'lgansiz!\n\nEndi kino kodini yuboring.",
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
      const shareKeyboard = new InlineKeyboard().switchInline(
        '📤 Share qilish',
        `s${serial.code}`,
      );

      if (episode.videoFileId) {
        await ctx.replyWithVideo(episode.videoFileId, {
          caption: `📺 ${episode.title || `Qism ${episode.episodeNumber}`}`,
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
            reply_markup: new InlineKeyboard().url(
              '▶️ Tomosha qilish',
              shareLink,
            ),
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
            reply_markup: new InlineKeyboard().url(
              '▶️ Tomosha qilish',
              shareLink,
            ),
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
