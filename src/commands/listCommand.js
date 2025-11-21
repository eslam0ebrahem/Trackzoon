import { ProductService } from '../services/productService.js';
import { formatProductLine } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { paginateItems, createPaginationKeyboard } from '../utils/pagination.js';
import { MessageBuilder } from '../utils/messageDesign.js';
import { handleError } from '../utils/errorHandler.js';

/**
 * /list command handler
 * Shows paginated list of user's tracked products
 */
export default (bot) => {
  const renderProductList = (products, chatId, page) => {
    const { items, currentPage, totalPages, totalItems, startIndex, endIndex } =
      paginateItems(products, page);

    const builder = new MessageBuilder();
    builder.setHeader('Your Tracked Products', '📋');

    if (totalItems === 0) {
      builder.addLine('You are not tracking any products yet.');
      builder.addTip('Use /add to start tracking!');
      return { message: builder.toString(), keyboard: mainKeyboard().reply_markup };
    }

    builder.addLine(`_Showing ${startIndex + 1}-${endIndex} of ${totalItems}_`);
    builder.addSpacer();

    items.forEach((p, idx) => {
      const actualIndex = startIndex + idx;
      const tracker = Array.isArray(p.trackedBy) ? p.trackedBy.find(t => t.chatId === chatId) : null;

      // Use existing format helper but maybe we can improve it later
      const line = formatProductLine(actualIndex + 1, p, tracker, true);
      builder.addLine(line);
      builder.addSpacer();
    });

    builder.addDivider();
    builder.addLine(`📄 Page ${currentPage} of ${totalPages}`);

    const keyboard = {
      inline_keyboard: [
        ...createPaginationKeyboard(currentPage, totalPages, 'list_page'),
        [{ text: '🔙 Main Menu', callback_data: 'action_main_menu' }]
      ]
    };

    return { message: builder.toString(), keyboard };
  };

  bot.command('list', async (ctx) => {
    try {
      const products = await ProductService.getUserProducts(ctx.chat.id);
      const { message, keyboard } = renderProductList(products, ctx.chat.id, 1);

      await ctx.reply(message, {
        parse_mode: 'Markdown', // Changed to Markdown (V1) for simpler handling or ensure V2 compliance
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
      const { message, keyboard } = renderProductList(products, ctx.chat.id, page);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
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
