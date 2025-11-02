import { Markup } from 'telegraf';

export const ProductKeyboards = {
  mainMenu: () => Markup.keyboard([
    ['➕ Add Product', '📋 My Products'],
    ['⚙️ Settings', '❓ Help']
  ]).resize(),

  confirmRemove: (asin) => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Yes', callback_data: `confirm_remove_${asin}` },
          { text: '❌ No', callback_data: 'cancel_remove' }
        ]
      ]
    }
  }),

  productActions: (asin) => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📊 View Details', callback_data: `view_${asin}` },
          { text: '💰 Set Price Alert', callback_data: `setthreshold_${asin}` }
        ],
        [{ text: '🗑️ Remove', callback_data: `remove_${asin}` }]
      ]
    }
  }),

  thresholdOptions: (asin, currentPrice) => {
    const options = [
      ['-20%', '-10%', '+10%', '+20%'].map(percent => {
        const multiplier = 1 + parseFloat(percent) / 100;
        const price = (currentPrice * multiplier).toFixed(2);
        return {
          text: `${percent} (£${price})`,
          callback_data: `setthreshold_value_${asin}_${price}`
        };
      })
    ];
    options.push([
      { text: '💸 Custom Price', callback_data: `setthreshold_custom_${asin}` }
    ]);
    return {
      reply_markup: {
        inline_keyboard: options
      }
    };
  },

  settings: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 Back to Main Menu', callback_data: 'back_to_main' }]
      ]
    }
  }),

  backButton: () => Markup.keyboard([
    ['🔙 Back']
  ]).resize()
};

export const removeKeyboard = () => Markup.removeKeyboard();