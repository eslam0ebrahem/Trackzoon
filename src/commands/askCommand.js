import { aiService } from '../services/aiService.js';
import Product from '../models/Product.js';
import { logger } from '../utils/logger.js';

export const askCommand = async (ctx) => {
    try {
        const query = ctx.message.text.split(' ').slice(1).join(' ');

        if (!query) {
            return ctx.reply('❓ Please ask a question after the command.\nExample: /ask Is now a good time to buy an iPhone?');
        }

        await ctx.sendChatAction('typing');

        // Get user's tracked products for context
        const chatId = ctx.chat.id;
        const products = await Product.find({ 'trackedBy.chatId': chatId });

        const answer = await aiService.answerQuestion(query, products);

        await ctx.reply(`🤖 *AI Assistant:*\n${answer}`, { parse_mode: 'Markdown' });

    } catch (error) {
        logger.error('Error in ask command:', error);
        ctx.reply('Sorry, something went wrong while asking the AI.');
    }
};
