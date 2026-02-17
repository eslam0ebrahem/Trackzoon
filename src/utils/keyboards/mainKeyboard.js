import { Markup } from 'telegraf';

export const mainKeyboard = () => {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛍️ Track New Product', callback_data: 'action_add_product' },
          { text: '📋 My Products', callback_data: 'action_list_products' }
        ],
        [
          { text: '🏆 Top 5 Deals', callback_data: 'action_top_deals' },
          { text: '📊 Daily Report', callback_data: 'action_report' }
        ],
        [
          { text: '📌 Pinned', callback_data: 'action_list_pinned' },
          { text: '⚙️ Settings', callback_data: 'action_settings' }
        ],
        [{ text: '❓ Help', callback_data: 'action_help' }]
      ]
    }
  };
};

export const productActionsKeyboard = (asin, tracker = null) => {
  const isPinned = tracker?.isPinned;
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📈 Price History', callback_data: `action_history_${asin}` },
          { text: '🎯 Set Threshold', callback_data: `action_threshold_${asin}` }
        ],
        [
          { text: '📉 Set % Drop', callback_data: `action_percentage_${asin}` },
          { text: '🧠 Smart Target', callback_data: `action_smart_target_${asin}` }
        ],
        [
          { text: '🧠 Insights', callback_data: `action_insights_${asin}` },
          { text: '🤖 AI Advice', callback_data: `action_ai_advice_${asin}` }
        ],
        [
          { text: isPinned ? '📌 Unpin' : '📌 Pin', callback_data: `action_toggle_pin_${asin}` },
          { text: '💤 Snooze', callback_data: `action_snooze_${asin}` }
        ],
        [
          { text: '❌ Stop Tracking', callback_data: `action_remove_${asin}` }
        ],
        [{ text: '🔙 Back to Products', callback_data: 'action_list_products' }]
      ]
    }
  };
};

export const thresholdKeyboard = (asin, currentPrice) => {
  const suggestedPercentages = [5, 10, 20];
  const buttons = suggestedPercentages.map(percent => {
    const price = (currentPrice * (1 - percent / 100)).toFixed(2);
    return {
      text: `${percent}% (EGP${price})`,
      callback_data: `action_set_threshold_${asin}_${price}`
    };
  });

  return {
    reply_markup: {
      inline_keyboard: [
        buttons,
        [{ text: '💭 Custom Threshold', callback_data: `action_custom_threshold_${asin}` }],
        [{ text: '🔙 Back', callback_data: `action_view_${asin}` }]
      ]
    }
  };
};

export const percentageKeyboard = (asin) => {
  const suggestedPercentages = [5, 10, 20];
  const buttons = suggestedPercentages.map(percent => ({
    text: `${percent}%`,
    callback_data: `action_set_percentage_${asin}_${percent}`
  }));

  return {
    reply_markup: {
      inline_keyboard: [
        buttons,
        [{ text: '💭 Custom Percentage', callback_data: `action_custom_percentage_${asin}` }],
        [{ text: '🔙 Back', callback_data: `action_view_${asin}` }]
      ]
    }
  };
};

export const confirmationKeyboard = (asin, action) => {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Yes', callback_data: `action_confirm_${action}_${asin}` },
          { text: '❌ No', callback_data: `action_cancel_${action}_${asin}` }
        ]
      ]
    }
  };
};

export const backToMainKeyboard = () => {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
      ]
    }
  };
};
