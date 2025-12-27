import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '../../../bot/bot.context';
import { InlineKeyboard, Keyboard } from 'grammy';
import { SerialService } from '../../content/services/serial.service';
import { EpisodeService } from '../../content/services/episode.service';
import { FieldService } from '../../field/services/field.service';
import { ChannelService } from '../../channel/services/channel.service';
import { SessionService } from './session.service';
import { AdminKeyboard } from '../keyboards/admin-menu.keyboard';
import { GrammyBotService } from '../../../common/grammy/grammy-bot.module';

export enum SerialManagementStep {
  CODE = 'code',
  TITLE = 'title',
  GENRE = 'genre',
  DESCRIPTION = 'description',
  FIELD = 'field',
  POSTER = 'poster',
  UPLOADING_EPISODES = 'uploading_episodes',
  POST_TO_FIELD = 'post_to_field',
}

@Injectable()
export class SerialManagementService {
  private readonly logger = new Logger(SerialManagementService.name);

  constructor(
    private serialService: SerialService,
    private episodeService: EpisodeService,
    private fieldService: FieldService,
    private channelService: ChannelService,
    private sessionService: SessionService,
    private grammyBot: GrammyBotService,
  ) {}

  // ========== NEW SERIAL CREATION ==========
  async handleNewSerialCode(ctx: BotContext, code: number) {
    if (!ctx.from) return;

    // Check if code is taken
    const existingSerial = await this.serialService.findByCode(code.toString());
    if (existingSerial) {
      const nearestCodes = await this.serialService.findNearestAvailableCodes(
        code,
        5,
      );
      let message = `❌ Kod ${code} band!\n\n`;
      if (nearestCodes.length > 0) {
        message += "✅ Bo'sh kodlar:\n";
        nearestCodes.forEach((c, i) => (message += `${i + 1}. ${c}\n`));
      }
      message += '\nBoshqa kod kiriting:';
      await ctx.reply(message, AdminKeyboard.getCancelButton());
      return;
    }

    this.sessionService.updateSessionData(ctx.from.id, { code });
    this.sessionService.setStep(ctx.from.id, 1); // TITLE step
    await ctx.reply(
      'Serial nomini kiriting:\nMasalan: Game of Thrones',
      AdminKeyboard.getCancelButton(),
    );
  }

  async handleSerialTitle(ctx: BotContext, title: string) {
    if (!ctx.from) return;
    this.sessionService.updateSessionData(ctx.from.id, { title });
    this.sessionService.setStep(ctx.from.id, 2); // GENRE step
    await ctx.reply(
      '🎭 Janr kiriting:\nMasalan: Drama, Action, Fantasy',
      AdminKeyboard.getCancelButton(),
    );
  }

  async handleSerialGenre(ctx: BotContext, genre: string) {
    if (!ctx.from) return;
    this.sessionService.updateSessionData(ctx.from.id, { genre });
    this.sessionService.setStep(ctx.from.id, 3); // DESCRIPTION step

    const keyboard = new Keyboard()
      .text('Next')
      .row()
      .text('❌ Bekor qilish')
      .resized();

    await ctx.reply(
      "📝 Tavsif kiriting:\n\n⏭ O'tkazib yuborish uchun 'Next' yozing",
      { reply_markup: keyboard },
    );
  }

  async handleSerialDescription(ctx: BotContext, description: string) {
    if (!ctx.from) return;

    if (description.toLowerCase() === 'next') {
      this.sessionService.updateSessionData(ctx.from.id, { description: null });
    } else {
      this.sessionService.updateSessionData(ctx.from.id, { description });
    }

    this.sessionService.setStep(ctx.from.id, 4); // FIELD step

    // Show fields
    const allFields = await this.fieldService.findAll();
    if (allFields.length === 0) {
      await ctx.reply('❌ Hech qanday field topilmadi. Avval field yarating.');
      this.sessionService.clearSession(ctx.from.id);
      return;
    }

    let message = '📁 Qaysi fieldni tanlaysiz?\n\n';
    allFields.forEach((field, index) => {
      message += `${index + 1}. ${field.name}\n`;
    });
    message += '\nRaqamini kiriting (masalan: 1)';

    this.sessionService.updateSessionData(ctx.from.id, { fields: allFields });
    await ctx.reply(message, AdminKeyboard.getCancelButton());
  }

  async handleSerialField(ctx: BotContext, fieldIndex: number, fields: any[]) {
    if (!ctx.from) return;

    if (fieldIndex < 0 || fieldIndex >= fields.length) {
      await ctx.reply("❌ Noto'g'ri raqam. Qaytadan kiriting:");
      return;
    }

    this.sessionService.updateSessionData(ctx.from.id, {
      selectedField: fields[fieldIndex],
      fieldId: fields[fieldIndex].id,
    });
    this.sessionService.setStep(ctx.from.id, 5); // POSTER step

    await ctx.reply(
      '🖼 Serial poster rasmini yuboring:',
      AdminKeyboard.getCancelButton(),
    );
  }

  async handleSerialPoster(ctx: BotContext, posterFileId: string) {
    if (!ctx.from) return;

    this.sessionService.updateSessionData(ctx.from.id, { posterFileId });
    this.sessionService.setStep(ctx.from.id, 6); // UPLOADING_EPISODES step
    this.sessionService.updateSessionData(ctx.from.id, {
      currentEpisode: 1,
      episodes: [],
    });

    await ctx.reply(
      '📹 1-qism videosini yuboring:',
      AdminKeyboard.getCancelButton(),
    );
  }

  // ========== EPISODE ADDING (NEW SERIAL) ==========
  async handleNewSerialEpisodeVideo(
    ctx: BotContext,
    videoFileId: string,
    session: any,
  ) {
    if (!ctx.from) return;

    const { currentEpisode, episodes } = session.data;

    // Save episode temporarily
    episodes.push({
      episodeNumber: currentEpisode,
      videoFileId,
    });

    this.sessionService.updateSessionData(ctx.from.id, { episodes });

    // Ask: continue or finish?
    const keyboard = new Keyboard()
      .text(`➕ ${currentEpisode + 1}-qism yuklash`)
      .row()
      .text('✅ Tugatish')
      .row()
      .text('❌ Bekor qilish')
      .resized();

    await ctx.reply(
      `✅ ${currentEpisode}-qism yuklandi!\n\nDavom ettirasizmi?`,
      { reply_markup: keyboard },
    );
  }

  async handleContinueOrFinish(ctx: BotContext, action: string) {
    if (!ctx.from) return;

    const session = this.sessionService.getSession(ctx.from.id);
    if (!session) return;

    if (action.includes('qism yuklash')) {
      // Continue adding episodes
      const { currentEpisode } = session.data;
      this.sessionService.updateSessionData(ctx.from.id, {
        currentEpisode: currentEpisode + 1,
      });

      await ctx.reply(
        `📹 ${currentEpisode + 1}-qism videosini yuboring:`,
        AdminKeyboard.getCancelButton(),
      );
    } else if (action === '✅ Tugatish') {
      // Finish and ask about posting to field
      const keyboard = new Keyboard()
        .text('✅ Ha, field kanalga tashla')
        .row()
        .text("❌ Yo'q, faqat saqlash")
        .resized();

      await ctx.reply('📺 Serial tayyorlandi!\n\nField kanalga tashlansinmi?', {
        reply_markup: keyboard,
      });
    }
  }

  async finalizNewSerial(ctx: BotContext, postToField: boolean) {
    if (!ctx.from) return;

    const session = this.sessionService.getSession(ctx.from.id);
    if (!session) return;

    const {
      code,
      title,
      genre,
      description,
      fieldId,
      selectedField,
      posterFileId,
      episodes,
    } = session.data;

    try {
      await ctx.reply('⏳ Serial yuklanmoqda...');

      // Get database channels
      const dbChannels = await this.channelService.findAllDatabase();
      if (dbChannels.length === 0) {
        await ctx.reply('❌ Database kanal topilmadi!');
        return;
      }

      // Upload all episode videos to database channels
      const episodeData = [];
      for (const ep of episodes) {
        const videoMessages = [];
        for (const dbChannel of dbChannels) {
          try {
            const sentVideo = await ctx.api.sendVideo(
              dbChannel.channelId,
              ep.videoFileId,
              {
                caption: `📺 ${title}\n📹 ${ep.episodeNumber}-qism\n🆔 Kod: ${code}`,
              },
            );
            videoMessages.push({
              channelId: dbChannel.channelId,
              messageId: sentVideo.message_id,
            });
          } catch (error) {
            this.logger.error(
              `Error uploading to ${dbChannel.channelName}:`,
              error,
            );
          }
        }

        episodeData.push({
          episodeNumber: ep.episodeNumber,
          videoFileId: ep.videoFileId,
          videoMessageId: JSON.stringify(videoMessages),
        });
      }

      // Create serial in database
      const serial = await this.serialService.create({
        code: code.toString(),
        title,
        genre,
        description,
        fieldId,
        posterFileId,
        totalEpisodes: episodes.length,
        channelMessageId: 0, // Will update if posting to field
      });

      // Create episodes
      for (const epData of episodeData) {
        await this.episodeService.create({
          serialId: serial.id,
          episodeNumber: epData.episodeNumber,
          videoFileId: epData.videoFileId,
          videoMessageId: epData.videoMessageId,
        });
      }

      // Post to field channel if requested
      let posterMessageId = 0;
      if (postToField) {
        const caption = `
${title}

${description || ''}

📖 Qismlar: ${episodes.length}
🎭 Janrlari: ${genre}
🔖 Kanal: ${selectedField.channelLink || '@' + selectedField.name}
        `.trim();

        const keyboard = new InlineKeyboard().url(
          '✨ Tomosha Qilish',
          `https://t.me/${this.grammyBot.botUsername}?start=s${code}`,
        );

        const sentPoster = await ctx.api.sendPhoto(
          selectedField.channelId,
          posterFileId,
          {
            caption,
            reply_markup: keyboard,
          },
        );

        posterMessageId = sentPoster.message_id;

        // Update serial with poster message ID
        await this.serialService.update(serial.id, {
          channelMessageId: posterMessageId,
        });
      }

      this.sessionService.clearSession(ctx.from.id);

      await ctx.reply(
        `✅ Serial muvaffaqiyatli yaratildi!\n\n` +
          `📺 ${title}\n` +
          `📹 Qismlar: ${episodes.length}\n` +
          `📦 Field: ${selectedField.name}\n` +
          (posterMessageId ? `🔗 Poster Message ID: ${posterMessageId}\n` : ''),
        AdminKeyboard.getAdminMainMenu('ADMIN'),
      );
    } catch (error) {
      this.logger.error('Error creating serial:', error);
      await ctx.reply(`❌ Xatolik: ${error.message}`);
    }
  }

  // ========== ADDING EPISODE TO EXISTING SERIAL ==========
  async handleAddEpisodeCode(ctx: BotContext, code: number) {
    if (!ctx.from) return;

    const serial = await this.serialService.findByCode(code.toString());
    if (!serial) {
      await ctx.reply(
        '❌ Bu kod bilan serial topilmadi!\nBoshqa kod kiriting:',
        AdminKeyboard.getCancelButton(),
      );
      return;
    }

    // Get current episodes count
    const episodes = await this.episodeService.findBySerialId(serial.id);
    const nextEpisodeNumber = episodes.length + 1;

    this.sessionService.updateSessionData(ctx.from.id, {
      serial,
      nextEpisodeNumber,
      addedEpisodes: [],
    });

    await ctx.reply(
      `📺 Serial topildi!\n\n` +
        `🏷 ${serial.title}\n` +
        `📹 Mavjud qismlar: ${episodes.length}\n\n` +
        `📹 ${nextEpisodeNumber}-qism videosini yuboring:`,
      AdminKeyboard.getCancelButton(),
    );
  }

  async handleExistingSerialEpisodeVideo(
    ctx: BotContext,
    videoFileId: string,
    session: any,
  ) {
    if (!ctx.from) return;

    const { serial, nextEpisodeNumber, addedEpisodes } = session.data;

    // Save episode temporarily
    addedEpisodes.push({
      episodeNumber: nextEpisodeNumber,
      videoFileId,
    });

    this.sessionService.updateSessionData(ctx.from.id, {
      addedEpisodes,
      nextEpisodeNumber: nextEpisodeNumber + 1,
    });

    const keyboard = new Keyboard()
      .text(`➕ ${nextEpisodeNumber + 1}-qism yuklash`)
      .row()
      .text('✅ Tugatish')
      .row()
      .text('❌ Bekor qilish')
      .resized();

    await ctx.reply(
      `✅ ${nextEpisodeNumber}-qism yuklandi!\n\nDavom ettirasizmi?`,
      { reply_markup: keyboard },
    );
  }

  async finalizeAddingEpisodes(ctx: BotContext, updateField: boolean) {
    if (!ctx.from) return;

    const session = this.sessionService.getSession(ctx.from.id);
    if (!session) return;

    const { serial, addedEpisodes } = session.data;

    try {
      await ctx.reply('⏳ Qismlar yuklanmoqda...');

      // Get database channels
      const dbChannels = await this.channelService.findAllDatabase();

      // Upload episodes
      for (const ep of addedEpisodes) {
        const videoMessages = [];
        for (const dbChannel of dbChannels) {
          try {
            const sentVideo = await ctx.api.sendVideo(
              dbChannel.channelId,
              ep.videoFileId,
              {
                caption: `📺 ${serial.title}\n📹 ${ep.episodeNumber}-qism\n🆔 Kod: ${serial.code}`,
              },
            );
            videoMessages.push({
              channelId: dbChannel.channelId,
              messageId: sentVideo.message_id,
            });
          } catch (error) {
            this.logger.error('Error uploading episode:', error);
          }
        }

        // Save episode to database
        await this.episodeService.create({
          serialId: serial.id,
          episodeNumber: ep.episodeNumber,
          videoFileId: ep.videoFileId,
          videoMessageId: JSON.stringify(videoMessages),
        });
      }

      // Update serial total episodes
      const allEpisodes = await this.episodeService.findBySerialId(serial.id);
      await this.serialService.update(serial.id, {
        totalEpisodes: allEpisodes.length,
      });

      // Update field channel poster if requested
      if (updateField && serial.channelMessageId) {
        const field = await this.fieldService.findOne(serial.fieldId);
        if (field) {
          const caption = `
${serial.title}

${serial.description || ''}

📖 Qismlar: ${allEpisodes.length}
🎭 Janrlari: ${serial.genre}
🔖 Kanal: ${field.channelLink || '@' + field.name}
          `.trim();

          const keyboard = new InlineKeyboard().url(
            '✨ Tomosha Qilish',
            `https://t.me/${this.grammyBot.botUsername}?start=s${serial.code}`,
          );

          try {
            await ctx.api.editMessageCaption(
              field.channelId,
              serial.channelMessageId,
              {
                caption,
                reply_markup: keyboard,
              },
            );
          } catch (error) {
            this.logger.error('Error updating field channel poster:', error);
          }
        }
      }

      this.sessionService.clearSession(ctx.from.id);

      await ctx.reply(
        `✅ Qismlar muvaffaqiyatli qo'shildi!\n\n` +
          `📺 ${serial.title}\n` +
          `📹 Jami qismlar: ${allEpisodes.length}\n` +
          `➕ Qo'shildi: ${addedEpisodes.length} ta`,
        AdminKeyboard.getAdminMainMenu('ADMIN'),
      );
    } catch (error) {
      this.logger.error('Error finalizing episodes:', error);
      await ctx.reply(`❌ Xatolik: ${error.message}`);
    }
  }
}
