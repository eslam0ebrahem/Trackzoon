# Trackzoon - Amazon Price Tracker BotThis is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).



🤖 A powerful Telegram bot built with **NestJS** to track Amazon product prices and notify you when they drop!## Getting Started



## 🚀 FeaturesFirst, run the development server:



- 📊 **Real-time Price Tracking** - Monitors Amazon product prices 24/7```bash

- 🔔 **Instant Notifications** - Get alerts when prices drop below your targetnpm run dev

- 📈 **Price History** - View historical price data and trends  # or

- ⚙️ **Customizable Settings** - Set your preferences and notificationsyarn dev

- 🌍 **Multi-marketplace Support** - Works with Amazon sites worldwide# or

- ⏰ **Automated Checks** - Automatic price checks every 30 minutespnpm dev

# or

## 🛠️ Tech Stackbun dev

```

- **Framework**: NestJS 10

- **Bot Library**: Telegraf 4.16Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

- **Database**: MongoDB (Mongoose ODM)

- **Language**: TypeScriptYou can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

- **Scheduler**: NestJS Schedule

- **Scraper**: Axios + CheerioThis project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.



## 📋 Prerequisites## Learn More



- Node.js >= 20.9.0To learn more about Next.js, take a look at the following resources:

- MongoDB database  

- Telegram Bot Token (from [@BotFather](https://t.me/botfather))- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.

- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## 🔧 Installation

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

1. **Clone the repository**

   ```bash## Deploy on Vercel

   git clone https://github.com/eslam0ebrahem/Trackzoon.git

   cd TrackzoonThe easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

   ```

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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
   PORT=3000
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start the bot**
   ```bash
   npm run start:prod
   ```

## 🚀 Development

Run in development mode with hot-reload:
```bash
npm run start:dev
```

## 📦 Project Structure

```
src/
├── bot/
│   ├── bot.module.ts         # Bot module configuration
│   └── bot.update.ts         # Bot commands and handlers
├── database/
│   └── schemas/
│       ├── user.schema.ts    # User model
│       └── product.schema.ts # Product model
├── services/
│   ├── user.service.ts       # User management
│   ├── product.service.ts    # Product management
│   ├── scraper.service.ts    # Amazon scraper
│   └── price-tracker.service.ts # Price monitoring
├── app.module.ts             # Root module
└── main.ts                   # Application entry point
```

## 🤖 Bot Commands

- `/start` - Start the bot and see welcome message
- `/help` - Show help and available commands
- `/list` - View all your tracked products
- `/add <URL> <price>` - Add a product to track
- `/remove <ASIN>` - Stop tracking a product
- `/report` - Get your daily price report
- `/settings` - Manage bot preferences

## 💡 Usage

1. Start a chat with your bot on Telegram
2. Send `/start` to initialize
3. Send any Amazon product URL
4. Set your target price
5. Get notified when price drops!

## 🚢 Deployment

### Deploy to Railway.app (Recommended)

1. Push your code to GitHub
2. Go to [Railway.app](https://railway.app)
3. Create new project from GitHub repo
4. Add environment variables:
   - `MONGODB_URI`
   - `BOT_TOKEN`
5. Deploy! ✅

### Deploy to Other Platforms

The bot works on any platform that supports Node.js:
- Heroku
- Render.com
- DigitalOcean App Platform
- AWS EC2
- VPS

## 🔒 MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a cluster (FREE tier available)
3. Go to **Network Access** → Add IP Address
4. Choose **"Allow Access from Anywhere"** (0.0.0.0/0)
5. Go to **Database Access** → Create user
6. Get your connection string

## 📊 Monitoring

The bot runs scheduled price checks every 30 minutes automatically. Logs show:
- ✅ Successful price checks
- 📉 Price drops detected
- 🔔 Notifications sent
- ❌ Any errors encountered

## 🛡️ Error Handling

The bot includes comprehensive error handling:
- Graceful MongoDB connection retries
- Amazon scraping fallbacks
- User-friendly error messages
- Automatic retry mechanisms

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 👨‍💻 Author

**Eslam Ebrahem**
- GitHub: [@eslam0ebrahem](https://github.com/eslam0ebrahem)

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- Telegram bot powered by [Telegraf](https://telegraf.js.org/)
- Database: [MongoDB](https://www.mongodb.com/)

---

⭐ **Star this repo if you find it useful!**
