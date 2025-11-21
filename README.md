# Trackzoon - Amazon Price Tracker Bot

🤖 A powerful Telegram bot built with **Node.js** to track Amazon product prices and notify you when they drop!

## 🚀 Features

- 📊 **Real-time Price Tracking** - Monitors Amazon product prices 24/7
- 🔔 **Instant Notifications** - Get alerts when prices drop below your target
- 📈 **Price History** - View historical price data and trends
- ⚙️ **Customizable Settings** - Set your preferences and notifications
- 🌍 **Multi-marketplace Support** - Works with Amazon sites worldwide
- ⏰ **Automated Checks** - Automatic price checks every 30 minutes

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Bot Library**: Telegraf
- **Database**: MongoDB (Mongoose ODM)
- **Language**: JavaScript (ES Modules)
- **Scheduler**: node-cron
- **Scraper**: Axios + Cheerio

## 📋 Prerequisites

- Node.js >= 18.0.0
- MongoDB database
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/eslam0ebrahem/Trackzoon.git
   cd Trackzoon
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your credentials:
   ```env
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/trackzoon
   BOT_TOKEN=your_bot_token_here
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

## 🚀 Development

Run in development mode:
```bash
npm run dev
```

## 📦 Project Structure

```
bot/
├── actions/          # Button click handlers
├── commands/         # Command handlers
├── config/           # Configuration (DB, Sentry, etc.)
├── core/             # Bot initialization
├── middleware/       # Telegraf middleware
├── models/           # Mongoose models
├── scheduler/        # Cron jobs
├── services/         # Business logic
├── utils/            # Helpers and utilities
├── handlers.js       # Main handler registration
└── index.js          # Entry point
```

## 🤖 Bot Commands

- `/start` - Start the bot and see welcome message
- `/help` - Show help and available commands
- `/list` - View all your tracked products
- `/add <URL> <price>` - Add a product to track
- `/removeone <ASIN>` - Stop tracking a product
- `/report` - Get your daily price report
- `/settings` - Manage bot preferences

## 🚢 Deployment

### Deploy to Railway.app (Recommended)

1. Push your code to GitHub
2. Go to [Railway.app](https://railway.app)
3. Create new project from GitHub repo
4. Add environment variables:
   - `MONGODB_URI`
   - `BOT_TOKEN`
5. Deploy! ✅

## 📄 License

MIT License

## 👨‍💻 Author

**Eslam Ebrahem**
- GitHub: [@eslam0ebrahem](https://github.com/eslam0ebrahem)
