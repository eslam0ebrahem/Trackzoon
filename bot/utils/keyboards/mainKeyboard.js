import { Markup } from 'telegraf';

export const mainKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🛍️ Track New Product', 'action_add_product'),
      Markup.button.callback('📋 My Products', 'action_list_products')
    ],
    [
      Markup.button.callback('📊 View Statistics', 'action_view_stats'),
      Markup.button.callback('⚙️ Settings', 'action_settings')
    ],
    [Markup.button.callback('❓ Help', 'action_help')]
  ]);
};

export const productActionsKeyboard = (asin) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📈 Price History', `action_history_${asin}`),
      Markup.button.callback('🎯 Set Threshold', `action_threshold_${asin}`)
    ],
    [
      Markup.button.callback('🔕 Mute Alerts', `action_mute_${asin}`),
      Markup.button.callback('❌ Stop Tracking', `action_remove_${asin}`)
    ],
    [Markup.button.callback('🔙 Back to Products', 'action_list_products')]
  ]);
};

export const thresholdKeyboard = (asin, currentPrice) => {
  const suggestedPercentages = [5, 10, 20];
  const buttons = suggestedPercentages.map(percent => {
    const price = (currentPrice * (1 - percent/100)).toFixed(2);
    return Markup.button.callback(
      `${percent}% (£${price})`,
      `action_set_threshold_${asin}_${price}`
    );
  });

  return Markup.inlineKeyboard([
    buttons,
    [Markup.button.callback('💭 Custom Threshold', `action_custom_threshold_${asin}`)],
    [Markup.button.callback('🔙 Back', `action_view_${asin}`)]
  ]);
};

export const confirmationKeyboard = (asin, action) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Yes', `action_confirm_${action}_${asin}`),
      Markup.button.callback('❌ No', `action_cancel_${action}_${asin}`)
    ]
  ]);
};

export const backToMainKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back to Main Menu', 'action_main_menu')]
  ]);
};