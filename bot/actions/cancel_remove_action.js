// bot/actions/cancel_remove_action.js
import { i18next } from '../config/i18n.js';

export default (bot, i18next) => {
  bot.action('cancel_remove', (ctx) => {
    ctx.editMessageText(i18next.t('removeCancelled'));
  });
};
