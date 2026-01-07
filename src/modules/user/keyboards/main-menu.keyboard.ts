import { Keyboard, InlineKeyboard } from 'grammy';
import { LanguageTexts } from '../../language/interfaces/language-texts.interface';

export class MainMenuKeyboard {
  static getMainMenu(isPremium: boolean = false) {
<<<<<<< HEAD
    const keyboard = new Keyboard().text("🔍 Kino kodi bo'yicha qidirish");

    if (!isPremium) {
      keyboard.text('💎 Premium sotib olish');
    }

    keyboard.row().text('ℹ️ Bot haqida').text('📞 Aloqa');
=======
    const keyboard = new Keyboard()
      .text("🔍 Kino kodi bo'yicha qidirish")
      .row()
      .text("📁 Field kanallariga o'tish")
      .row();

    if (!isPremium) {
      keyboard.text('💎 Premium sotib olish').row();
    }

    keyboard
      .text('ℹ️ Bot haqida')
      .text('👤 Profil')
      .row()
      .text('📞 Aloqa')
      .text('⚙️ Sozlamalar');
>>>>>>> 9e7ed34722035ce8c5e304e50c0ff830bf2359f3

    return { reply_markup: keyboard.resized() };
  }

  static getLanguageMenu(texts: LanguageTexts) {
    const keyboard = new InlineKeyboard()
      .text("🇺🇿 O'zbekcha", 'lang_uz')
      .text('🇷🇺 Русский', 'lang_ru')
      .row()
      .text('🇬🇧 English', 'lang_en');

    return { reply_markup: keyboard };
  }

  static getPremiumMenu(texts: LanguageTexts) {
    const keyboard = new InlineKeyboard()
      .text(texts.monthlyPremium, 'buy_premium_1')
      .text(texts.threeMonthPremium, 'buy_premium_3')
      .row()
      .text(texts.sixMonthPremium, 'buy_premium_6')
      .text(texts.yearlyPremium, 'buy_premium_12');

    return { reply_markup: keyboard };
  }

  static getBackButton(texts: LanguageTexts) {
    const keyboard = new Keyboard().text(texts.backButton);
    return { reply_markup: keyboard.resized() };
  }

  static removeKeyboard() {
    return { reply_markup: { remove_keyboard: true } };
  }
}
