# Telegraf to Grammy Migration Guide

Bu loyihani Telegraf'dan Grammy'ga migratsiya qilish bo'yicha to'liq qo'llanma.

## 1. Dependencies O'zgarish

### package.json
```json
// OLD (Telegraf)
"telegraf": "^4.16.3",
"nestjs-telegraf": "^2.9.1"

// NEW (Grammy)  
"grammy": "^1.38.4",
"@grammyjs/types": "^3.22.2"
```

## 2. Imports O'zgarish

```typescript
// OLD
import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { Update, Hears, Ctx, Action, On, Command } from 'nestjs-telegraf';

// NEW
import { Context } from 'grammy';
import { InlineKeyboard, Keyboard } from 'grammy';
// Decoratorlar uchun custom implementation kerak yoki
// to'g'ridan-to'g'ri bot.on() ishlatish
```

## 3. Context O'zgarish

```typescript
// OLD
export interface BotContext extends TelegrafContext {
  session?: SessionData;
}

// NEW
export interface BotContext extends Context {
  session?: SessionData;
}
```

## 4. Bot API O'zgarishlari

### Callback Query
```typescript
// OLD
await ctx.answerCbQuery('Message');

// NEW
await ctx.answerCallbackQuery({ text: 'Message' });
// yoki
await ctx.answerCallbackQuery();
```

### Telegram API
```typescript
// OLD
await ctx.telegram.getChatMember(channelId, userId);
await ctx.telegram.sendPhoto(chatId, photo);
await ctx.telegram.forwardMessage(to, from, messageId);

// NEW
await ctx.api.getChatMember(channelId, userId);
await ctx.api.sendPhoto(chatId, photo);
await ctx.api.forwardMessage(to, from, messageId);
```

## 5. Keyboards/Buttons O'zgarish

### Inline Keyboard
```typescript
// OLD (Telegraf)
const buttons = Markup.inlineKeyboard([
  [Markup.button.url('Button 1', 'https://example.com')],
  [Markup.button.callback('Button 2', 'callback_data')],
]);
await ctx.reply('Text', buttons);

// NEW (Grammy)
const keyboard = new InlineKeyboard()
  .url('Button 1', 'https://example.com')
  .row()
  .text('Button 2', 'callback_data');
await ctx.reply('Text', { reply_markup: keyboard });
```

### Regular Keyboard
```typescript
// OLD (Telegraf)
const keyboard = Markup.keyboard([
  ['Button 1', 'Button 2'],
  ['Button 3']
]).resize();
await ctx.reply('Text', keyboard);

// NEW (Grammy)
const keyboard = new Keyboard()
  .text('Button 1').text('Button 2')
  .row()
  .text('Button 3')
  .resized();
await ctx.reply('Text', { reply_markup: keyboard });
```

## 6. Handlers O'zgarish

### NestJS Integration

Grammy uchun maxsus NestJS module kerak. Men `GrammyBotModule` yaratdim:

```typescript
// src/common/grammy/grammy-bot.module.ts
@Injectable()
export class GrammyBotService implements OnModuleInit {
  public bot: Bot<BotContext>;

  constructor() {
    this.bot = new Bot<BotContext>(process.env.BOT_TOKEN as string);
  }

  async onModuleInit() {
    // Middleware
    this.bot.use(async (ctx, next) => {
      // Your middleware logic
      return next();
    });

    // Handlers
    this.registerHandlers();

    // Start bot
    await this.bot.start();
  }

  private registerHandlers() {
    // Command handlers
    this.bot.command('start', async (ctx) => {
      await ctx.reply('Hello!');
    });

    // Text handlers
    this.bot.hears('Button text', async (ctx) => {
      await ctx.reply('You clicked button');
    });

    // Callback query handlers
    this.bot.callbackQuery(/^action_(.+)$/, async (ctx) => {
      const data = ctx.match[1];
      await ctx.answerCallbackQuery();
      await ctx.reply(`Action: ${data}`);
    });

    // Photo handler
    this.bot.on('message:photo', async (ctx) => {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      await ctx.reply(`Photo ID: ${photo.file_id}`);
    });
  }
}
```

## 7. File Structure O'zgarishi

### Handler Service Pattern

Telegraf decorator-based approach o'rniga, Grammy'da handler service yaratish yaxshiroq:

```typescript
// user-handlers.service.ts
@Injectable()
export class UserHandlersService {
  constructor(
    private grammyBot: GrammyBotService,
    private userService: UserService,
    // other services
  ) {}

  onModuleInit() {
    this.registerHandlers();
  }

  private registerHandlers() {
    const bot = this.grammyBot.bot;

    // /start command
    bot.command('start', this.handleStart.bind(this));

    // Search button
    bot.hears('🔍 Qidirish', this.handleSearch.bind(this));

    // Callback queries
    bot.callbackQuery(/^movie_(.+)$/, this.handleMovieCallback.bind(this));
  }

  private async handleStart(ctx: BotContext) {
    const user = await this.userService.findOrCreate(String(ctx.from.id), {
      firstName: ctx.from.first_name,
      //...
    });

    const keyboard = new InlineKeyboard()
      .text('Button 1', 'data_1')
      .row()
      .text('Button 2', 'data_2');

    await ctx.reply('Welcome!', { reply_markup: keyboard });
  }

  private async handleSearch(ctx: BotContext) {
    // Search logic
  }

  private async handleMovieCallback(ctx: BotContext) {
    const movieCode = ctx.match[1];
    await ctx.answerCallbackQuery();
    // Movie delivery logic
  }
}
```

## 8. Update Existing Files

### bot.update.ts
```typescript
// OLD
@Update()
@Injectable()
export class BotUpdate {
  constructor(private prisma: PrismaService) {}

  @Action('check_subscription')
  async checkSubscription(@Ctx() ctx: Context) {
    // Logic
  }
}

// NEW - Service pattern bilan
@Injectable()
export class BotHandlersService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private grammyBot: GrammyBotService,
  ) {}

  onModuleInit() {
    this.grammyBot.bot.callbackQuery('check_subscription', 
      this.checkSubscription.bind(this)
    );
  }

  private async checkSubscription(ctx: BotContext) {
    if (!ctx.from) return;

    await ctx.answerCallbackQuery();

    const channels = await this.prisma.mandatoryChannel.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    for (const channel of channels) {
      try {
        const member = await ctx.api.getChatMember(
          channel.channelId,
          ctx.from.id,
        );
        // ...
      } catch (error) {
        // ...
      }
    }
  }
}
```

## 9. Migration Checklist

### Fayllar ro'yxati:
- [x] package.json - Dependencies o'zgartirildi
- [x] src/bot/bot.context.ts - Context interfeys
- [x] src/common/grammy/grammy-bot.module.ts - Yangi bot module
- [ ] src/bot/bot.update.ts - Handler servicega o'zgartirish
- [ ] src/modules/user/user.handler.ts - Service patternга o'zgartirish  
- [ ] src/modules/admin/admin.handler.ts - Service patternга o'zgartirish
- [ ] src/app.module.ts - Module imports
- [ ] Keyboards - InlineKeyboard/Keyboard ishlatish
- [ ] All ctx.telegram -> ctx.api
- [ ] All ctx.answerCbQuery -> ctx.answerCallbackQuery

## 10. Helper Utilities

### Keyboard Helper (Telegraf-like API)
```typescript
// src/common/utils/keyboard.helper.ts
export class MarkupHelper {
  static inlineKeyboard(buttons: any[][]): { reply_markup: InlineKeyboard } {
    const keyboard = new InlineKeyboard();
    
    buttons.forEach((row, rowIndex) => {
      row.forEach((btn) => {
        if (btn.url) {
          keyboard.url(btn.text, btn.url);
        } else if (btn.callback_data) {
          keyboard.text(btn.text, btn.callback_data);
        }
      });
      
      if (rowIndex < buttons.length - 1) {
        keyboard.row();
      }
    });
    
    return { reply_markup: keyboard };
  }

  static button = {
    callback: (text: string, data: string) => ({
      text,
      callback_data: data,
    }),
    url: (text: string, url: string) => ({
      text,
      url,
    }),
  };
}
```

## 11. Testing

```bash
# Install dependencies
pnpm install

# Generate Prisma Client
pnpm prisma:generate

# Start development
pnpm start:dev
```

## 12. Common Issues

### Issue 1: Decorators not working
**Solution**: Use service pattern with bot.on/command/hears/callbackQuery

### Issue 2: Markup not found
**Solution**: Import { InlineKeyboard, Keyboard } from 'grammy'

### Issue 3: ctx.telegram not found
**Solution**: Use ctx.api instead

### Issue 4: answerCbQuery not found
**Solution**: Use ctx.answerCallbackQuery()

## 13. Full Example

```typescript
// complete-handler.service.ts
@Injectable()
export class CompleteHandlerService implements OnModuleInit {
  constructor(
    private grammyBot: GrammyBotService,
    private userService: UserService,
    private movieService: MovieService,
  ) {}

  onModuleInit() {
    const bot = this.grammyBot.bot;

    // Commands
    bot.command('start', this.handleStart.bind(this));
    bot.command('premium', this.handlePremium.bind(this));

    // Text messages
    bot.hears('🔍 Qidirish', this.handleSearch.bind(this));
    bot.hears('💎 Premium', this.handlePremium.bind(this));

    // Callback queries
    bot.callbackQuery('check_subscription', this.checkSubscription.bind(this));
    bot.callbackQuery(/^movie_(.+)$/, this.sendMovie.bind(this));
    bot.callbackQuery(/^lang_(.+)$/, this.changeLanguage.bind(this));

    // Media
    bot.on('message:photo', this.handlePhoto.bind(this));
    bot.on('message:video', this.handleVideo.bind(this));
  }

  private async handleStart(ctx: BotContext) {
    const user = await this.userService.findOrCreate(String(ctx.from.id), {
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      username: ctx.from.username,
    });

    const keyboard = new InlineKeyboard()
      .text('🔍 Qidirish', 'search')
      .text('💎 Premium', 'premium')
      .row()
      .text('ℹ️ Bot haqida', 'about');

    await ctx.reply(Welcome message here!', {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  }

  private async handleSearch(ctx: BotContext) {
    await ctx.reply('Kino yoki serial kodini kiriting:');
  }

  private async checkSubscription(ctx: BotContext) {
    await ctx.answerCallbackQuery({ text: 'Tekshirilmoqda...' });
    
    const channels = await this.channelService.findAllMandatory();
    
    for (const channel of channels) {
      const member = await ctx.api.getChatMember(
        channel.channelId,
        ctx.from.id,
      );
      // ...
    }
  }

  private async sendMovie(ctx: BotContext) {
    const movieCode = ctx.match[1];
    await ctx.answerCallbackQuery();
    
    const movie = await this.movieService.findByCode(movieCode);
    if (!movie) {
      await ctx.reply('❌ Kino topilmadi');
      return;
    }

    await ctx.api.forwardMessage(
      ctx.chat.id,
      movie.field.channelId,
      movie.channelMessageId,
    );
  }
}
```

## Xulosa

Grammy integratsiyasi Telegraf'dan bir oz farq qiladi, lekin asosiy logika o'zgarmasdan qoladi. Asosiy o'zgarishlar:

1. Decorators o'rniga service pattern
2. Markup o'rniga InlineKeyboard/Keyboard  
3. ctx.telegram o'rniga ctx.api
4. answerCbQuery o'rniga answerCallbackQuery

Barcha fayllarni migratsiya qilish uchun yuqoridagi patternlarni qo'llang.
