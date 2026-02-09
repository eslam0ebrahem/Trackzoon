import { ProductService } from '../services/productService.js';
import { buildSmartInsightsMessage } from '../utils/insightsHelper.js';
import { escapeMarkdownV2, safeEditMessageText } from '../utils/messageHelper.js';

const buildSelectionKeyboard = (products = []) => {
  return products.slice(0, 10).map((product, index) => ([
    {
      text: `${index + 1}. ${product.name?.substring(0, 40) || product.asin || 'Product'}${product.name && product.name.length > 40 ? '...' : ''}`,
      callback_data: `action_insights_${product.asin}`
    }
  ]));
};

const getQuery = (text = '') => {
  const parts = text.split(' ').slice(1);
  return parts.join(' ').trim();
};

const findMatchingProducts = (products, query) => {
  const normalized = query.toLowerCase();
  const exact = products.find(p => p.asin && p.asin.toLowerCase() === normalized);
  if (exact) return { match: exact, matches: [exact] };

  const matches = products.filter(p => {
    const name = p.name ? p.name.toLowerCase() : '';
    const asin = p.asin ? p.asin.toLowerCase() : '';
    return name.includes(normalized) || asin.includes(normalized);
  });

  return { match: matches.length === 1 ? matches[0] : null, matches };
};

export default (bot) => {
  bot.command('insights', async (ctx) => {
    try {
      const query = getQuery(ctx.message.text);
      const products = await ProductService.getUserProducts(ctx.chat.id);

      if (!products || products.length === 0) {
        return await ctx.reply(
          '🧠 You are not tracking any products yet.\nUse /add to start tracking.',
          { parse_mode: 'Markdown' }
        );
      }

      if (!query) {
        const keyboard = buildSelectionKeyboard(products);
        return await ctx.reply(
          '🧠 *Select a product to view smart insights:*',
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
          }
        );
      }

      const { match, matches } = findMatchingProducts(products, query);

      if (!match && matches.length > 1) {
        const keyboard = buildSelectionKeyboard(matches);
        return await ctx.reply(
          `🧠 *Multiple matches found for:* ${escapeMarkdownV2(query)}\nPick one:`,
          {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: keyboard }
          }
        );
      }

      if (!match) {
        return await ctx.reply(
          `❌ No tracked product found for "${escapeMarkdownV2(query)}".\nTry /list to see your items.`,
          { parse_mode: 'MarkdownV2' }
        );
      }

      const message = buildSmartInsightsMessage(match);

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: `action_insights_${match.asin}` }],
            [{ text: '🔙 Back to Product', callback_data: `action_view_${match.asin}` }]
          ]
        }
      });
    } catch (error) {
      console.error('Error in insights command:', error);
      await ctx.reply('⚠️ Failed to generate insights. Please try again later.');
    }
  });

  bot.action(/action_insights_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      await ctx.answerCbQuery('⏳ Generating insights...');

      const product = await ProductService.getProduct(asin, ctx.chat.id);
      const message = buildSmartInsightsMessage(product);

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: `action_insights_${asin}` }],
            [{ text: '🔙 Back to Product', callback_data: `action_view_${asin}` }]
          ]
        }
      });
    } catch (error) {
      console.error('Error generating insights:', error);
      await ctx.answerCbQuery('⚠️ Error generating insights. Please try again.');
    }
  });
};
