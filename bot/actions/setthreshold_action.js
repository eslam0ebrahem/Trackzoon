// bot/actions/setthreshold_action.js
import { i18next } from '../config/i18n.js';

export default (bot, i18next, settingThreshold) => {
  bot.action(/setthreshold_(.+)/, async (ctx) => {
    const asin = ctx.match[1];
    settingThreshold.set(ctx.chat.id, asin);
    ctx.editMessageText(i18next.t('promptNewThreshold'));
  });
};
