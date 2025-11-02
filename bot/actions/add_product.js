// bot/actions/add_product.js
import { Messages } from '../utils/messages.js';

export default (bot, addingProductState) => {
  bot.action('add_product', (ctx) => {
    addingProductState.set(ctx.chat.id, { step: 'waiting_for_url', data: {} });
    // Provide a helpful example and hint about supported stores
    ctx.reply(Messages.promptForUrl + '\n\n' + Messages.exampleUrlHint);
  });
};
