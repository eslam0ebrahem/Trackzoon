import { Markup } from 'telegraf';

export const ProductKeyboards = {
  mainMenu: () => Markup.keyboard([
    ['➕ Add Product', '📋 My Products'],
    ['⚙️ Settings', '❓ Help']
  ]).resize(),

  confirmRemove: (asin) => Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Yes', `confirm_remove_${asin}`),
      Markup.button.callback('❌ No', 'cancel_remove')
    ]
  ]),

  productActions: (asin) => Markup.inlineKeyboard([
    [
      Markup.button.callback('📊 View Details', `view_${asin}`),
      Markup.button.callback('💰 Set Price Alert', `setthreshold_${asin}`)
    ],
    [Markup.button.callback('🗑️ Remove', `remove_${asin}`)]
  ]),

  thresholdOptions: (asin, currentPrice) => {
    const options = [
      ['-20%', '-10%', '+10%', '+20%'].map(percent => {
        const multiplier = 1 + parseFloat(percent) / 100;
        const price = (currentPrice * multiplier).toFixed(2);
        return Markup.button.callback(
          `${percent} (£${price})`,
          `setthreshold_value_${asin}_${price}`
        );
      })
    ];
    options.push([
      Markup.button.callback('💸 Custom Price', `setthreshold_custom_${asin}`)
    ]);
    return Markup.inlineKeyboard(options);
  },

  settings: () => Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Back to Main Menu', 'back_to_main')]
  ]),

  backButton: () => Markup.keyboard([
    ['🔙 Back']
  ]).resize()
};

export const removeKeyboard = () => Markup.removeKeyboard();