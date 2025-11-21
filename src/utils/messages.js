export const Messages = {
  noTrackedProducts: '📭 You haven\'t added any products to track yet. Use /add to start tracking a product.',
  promptForUrl: '🔗 Please send me the Amazon product URL you want to track.',
  exampleUrlHint: '💡 Example: https://www.amazon.eg/dp/B08N5XSG8Z',
  productNotFound: '❌ Product not found.',
  productNotFoundOrNotTracked: '❌ Product not found or not being tracked.',
  removeProduct: '🗑️ Remove',
  removeConfirmation: (name) => `🗑️ Are you sure you want to remove "${name}" from tracking?`,
  yesRemove: '✅ Yes, remove it',
  noKeep: '❌ No, keep it',
  notTracked: '❌ This product is not being tracked.',
  invalidThreshold: '❌ Invalid threshold. Please enter a valid number.',
  thresholdUpdated: ({ name, threshold }) => `✅ Threshold updated for "${name}" to ${threshold}`,
  setThreshold: '💰 Set Threshold',
  startMessage: '🚀 Welcome to Amazon Price Tracker! Let me help you track product prices.',
  addCommand: '➕ Add Product',
  listCommand: '📋 List Products',
  helpCommand: '❓ Help',
  manageProductActions: '📦 Product Management:',
  viewProduct: '👀 View',
  priceNotAvailable: 'N/A',
  notAvailable: 'N/A',
  notEnoughData: '📊 Not enough price history data to generate a chart.',
  historyCaption: ({ name }) => `📈 Price History for ${name}`,

  welcome: (username) => [
    `👋 Welcome ${username} to Amazon Price Tracker!`,
    '',
    '🔍 I help you track Amazon product prices and notify you when they drop.',
    '',
    '✨ Features:',
    '• Track multiple products simultaneously',
    '• Get instant alerts when prices drop',
    '• View price history and trends',
    '• Get recommendations for similar products',
    '',
    '🚀 Getting Started:',
    '1. Use /add to start tracking a product',
    '2. Set your desired price threshold',
    '3. Wait for price alerts!',
    '',
    'Need help? Use /help to see all commands'
  ].join('\\n'),

  help: [
    '📚 *Available Commands*',
    '',
    '🔰 Basic Commands:',
    '/start - Start the bot and see welcome message',
    '/help - Show this help message',
    '/settings - Configure your preferences',
    '',
    '📦 Product Management:',
    '/add - Add a new product to track',
    '/list - View all tracked products',
    '/view - View details of a specific product',
    '/remove - Stop tracking a product',
    '',
    '⚡️ Price Alerts:',
    '/setthreshold - Set price alert threshold',
    '/history - View price history',
    '',
    '💡 Pro Tips:',
    '• Send an Amazon link directly to add a product',
    '• Use inline buttons for quick actions',
    '• Check /list regularly for price updates'
  ].join('\\n'),

  addProduct: [
    '🛍️ *Add a Product to Track*',
    '',
    'Please send me the Amazon product URL you want to track.',
    '',
    '💡 Tips:',
    '• Make sure it\'s a valid Amazon product URL',
    '• You can copy the URL directly from your browser',
    '• The URL should contain a product ID (ASIN)',
    '',
    '📝 Example:',
    'https://www.amazon.eg/dp/B08N5XSG8Z'
  ].join('\\n'),

  processing: {
    url: '🔄 Processing URL... Please wait.',
    tracking: '🔄 Setting up price tracking... Please wait.',
    updating: '🔄 Updating threshold... Please wait.'
  },

  errors: {
    invalidUrl: [
      '❌ *Invalid Amazon URL*',
      '',
      'Please make sure to provide a valid Amazon product URL\\.',
      '',
      'Supported formats:',
      '• https://www\\.amazon\\.eg/dp/XXXXXXXXXX',
      '• https://amzn\\.eu/d/XXXXXXX',
      '• https://www\\.amazon\\.eg/gp/product/XXXXXXXXXX',
      '',
      '💡 Copy the URL directly from your browser'
    ].join('\\n'),

    invalidThreshold: [
      '❌ *Invalid Price Format*',
      '',
      '💡 Please follow these guidelines:',
      '• Use only numbers \\(e\\.g\\. 299\\.99\\)',
      '• Don\'t include currency symbols',
      '• Price must be greater than 0'
    ].join('\\n'),

    productNotFound: [
      '❌ *Product Not Found*',
      '',
      'Sorry, I couldn\'t find this product\\.',
      'Please check the URL and try again\\.'
    ].join('\\n'),

    alreadyTracking: [
      '❌ *Already Tracking*',
      '',
      'You\'re already tracking this product\\!',
      'Use /list to see all your tracked products\\.'
    ].join('\\n'),

    scrapingError: [
      '❌ *Fetch Error*',
      '',
      'Sorry, I couldn\'t fetch the product information\\.',
      'Please try again later\\.'
    ].join('\\n'),

    timeout: [
      '❌ *Operation Timed Out*',
      '',
      'The operation took too long to complete\\.',
      'Please try again\\.'
    ].join('\\n'),

    stateError: [
      '❌ *Invalid Operation*',
      '',
      'Can\'t perform this action right now\\.',
      'Please start over\\.'
    ].join('\\n'),

    networkError: [
      '❌ *Network Error*',
      '',
      'Connection failed\\.',
      'Please check your connection and try again\\.'
    ].join('\\n'),

    rateLimit: [
      '❌ *Too Many Requests*',
      '',
      'Please wait a moment before trying again\\.'
    ].join('\\n'),

    general: [
      '❌ *Error*',
      '',
      'Something went wrong\\.',
      'Please try again later\\.'
    ].join('\\n')
  },

  setThreshold: [
    '💰 Set Price Alert Threshold',
    '',
    'Please enter your desired price threshold. I\'ll notify you when the price drops below this amount.',
    '',
    '💡 Tips:',
    '• Enter the price in numbers (e.g. 299.99)',
    '• Set a realistic threshold - not too low!',
    '• You can update this later with /setthreshold',
    '',
    'Note: Price alerts only work when the price drops below your threshold.'
  ].join('\\n'),

  productAdded: (product, threshold, difference) => [
    '✅ *Product Added Successfully*',
    '',
    `📦 Product: [${escapeMarkdownV2(product.name)}](${product.url})`,
    `💵 Current Price: EGP${product.currentPrice.toFixed(2)}`,
    `🎯 Alert Price: EGP${threshold.toFixed(2)}`,
    '',
    product.currentPrice <= threshold
      ? '🎉 Good news! The current price is already below your alert threshold!'
      : [
        `📈 Current price is ${difference.toFixed(1)}% above your threshold.`,
        '🔔 I\'ll notify you when the price drops below your threshold!'
      ].join('\\n')
  ].join('\\n'),

  unknownCommand: '❓ I don\'t understand that command. Use /help to see available commands.',
  backToMain: '🔙 Back to main menu'
};