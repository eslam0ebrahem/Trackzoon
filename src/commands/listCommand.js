import { ProductService } from '../services/productService.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { buildPaginatedProductList, createPaginationKeyboard } from '../utils/pagination.js';
import { handleError } from '../utils/errorHandler.js';

/**
 * /list command handler
 * Shows paginated list of user's tracked products
 */
export default (bot) => {
  bot.command('list', async (ctx) => {
    try {
      const products = await ProductService.getUserProducts(ctx.chat.id);
      
      if (products.length === 0) {
        const message = '🔍 *No products tracked yet*\n\nUse /add to start tracking your first product\\.';
        return await ctx.reply(message, {
          parse_mode: 'MarkdownV2',
          ...mainKeyboard()
        });
      }

      // Show first page
      const { message, keyboard } = buildPaginatedProductList(
        products,
        ctx.chat.id,
        1
      );

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        reply_markup: keyboard
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  // Handle pagination
  bot.action(/^list_page_(\d+)$/, async (ctx) => {
    try {
      const page = parseInt(ctx.match[1]);
      const products = await ProductService.getUserProducts(ctx.chat.id);

      const { message, keyboard } = buildPaginatedProductList(
        products,
        ctx.chat.id,
        page
      );

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        reply_markup: keyboard
      });

      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Error in list pagination:', error);
      await ctx.answerCbQuery('⚠️ Error loading page. Please try again.');
    }
  });
};
