import { ProductService } from '../services/productService.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { handleError } from '../utils/errorHandler.js';

const HOURS_MIN = 1;
const HOURS_MAX = 168;

export default (bot) => {
  bot.command('snooze', async (ctx) => {
    try {
      const parts = ctx.message.text.split(' ').slice(1);
      if (parts.length < 2) {
        return await ctx.reply(
          '💤 *Usage:* /snooze <ASIN or product name> <hours>\n\nExample: /snooze B08N5XSG8Z 24',
          {
            parse_mode: 'MarkdownV2',
            ...mainKeyboard()
          }
        );
      }

      const hoursRaw = parts.pop();
      const identifier = parts.join(' ').trim();
      const hours = Number.parseInt(hoursRaw, 10);

      if (!identifier) {
        return await ctx.reply('❌ Please provide a product ASIN or name\.', {
          parse_mode: 'MarkdownV2',
          ...mainKeyboard()
        });
      }

      if (!Number.isFinite(hours) || hours < HOURS_MIN || hours > HOURS_MAX) {
        return await ctx.reply(`❌ Hours must be between ${HOURS_MIN} and ${HOURS_MAX}\.`, {
          parse_mode: 'MarkdownV2',
          ...mainKeyboard()
        });
      }

      const products = await ProductService.getUserProducts(ctx.chat.id);
      const normalized = identifier.toLowerCase();
      const product = products.find((p) => (
        String(p.asin).toLowerCase() === normalized ||
        String(p.name || '').toLowerCase().includes(normalized)
      ));

      if (!product) {
        return await ctx.reply(
          escapeMarkdownV2(`❌ Could not find a tracked product matching "${identifier}".`),
          {
            parse_mode: 'MarkdownV2',
            ...mainKeyboard()
          }
        );
      }

      const updated = await ProductService.snoozeProduct(product.asin, ctx.chat.id, hours);
      const snoozeUntil = updated.currentUserSubscription?.snoozeUntil
        ? new Date(updated.currentUserSubscription.snoozeUntil)
        : new Date(Date.now() + hours * 60 * 60 * 1000);

      const message = [
        '✅ *Alerts Snoozed*',
        '',
        `📦 ${escapeMarkdownV2(updated.name)}`,
        `⏳ Duration: ${escapeMarkdownV2(String(hours))} hour\(s\)`,
        `🕒 Until: ${escapeMarkdownV2(snoozeUntil.toLocaleString())}`
      ].join('\n');

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard(),
        disable_web_page_preview: true
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });
};
