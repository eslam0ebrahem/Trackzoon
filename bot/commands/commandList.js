// bot/commands/commandList.js

const commands = [
  { command: 'start', description: 'Start tracking Amazon products' },
  { command: 'add', description: 'Add a new product to track' },
  { command: 'add_percentage', description: 'Add a percentage-based price alert' },
  { command: 'list', description: 'List all tracked products' },
  { command: 'view', description: 'View details of a specific product' },
  { command: 'history', description: 'Show price history of a product' },
  { command: 'setthreshold', description: 'Set price threshold for alerts' },
  { command: 'remove', description: 'Remove a product from tracking' },
  { command: 'settings', description: 'Configure bot settings' },
  { command: 'help', description: 'Show available commands' }
];

export default commands;
