import { ProductService } from '../services/productService.js';
import { formatProductLine } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
  bot.command('pinned', async (ctx) => {
    try {
      const products = await ProductService.getPinnedProducts(ctx.chat.id);

      if (!products || products.length === 0) {
        return await ctx.reply(
          '📌 You have no pinned products yet\.\n\nOpen any product and tap *Pin* to keep it on top\.',
          {
            parse_mode: 'MarkdownV2',
            ...mainKeyboard()
          }
        );
      }

      let message = '📌 *Pinned Products*\n\n';
      products.slice(0, 20).forEach((product, idx) => {
        const tracker = Array.isArray(product.trackedBy)
          ? product.trackedBy.find((t) => String(t.chatId) === String(ctx.chat.id))
          : null;

        message += `${formatProductLine(idx + 1, product, tracker, true)}\n\n`;
      });

      message += '_Tip: use /list to view all tracked products._';

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...mainKeyboard()
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });
};
