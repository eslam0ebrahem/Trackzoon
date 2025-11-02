# Bot Deployment Guide - Railway.app

## Overview
Your Telegram bot runs separately from the Next.js web dashboard:
- **Web Dashboard**: Hosted on Vercel
- **Telegram Bot**: Hosted on Railway.app (FREE)

## Why Separate?
- Your bot needs to run 24/7 (long-running process)
- Vercel is for serverless web apps (not long-running processes)
- Railway.app provides FREE always-on hosting perfect for bots

---

## Deploy Bot to Railway.app

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub (it's FREE - no credit card needed)
3. You get $5 credit monthly (enough for small bots)

### Step 2: Create New Project
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Connect your GitHub account if not already connected
4. Select your repository: `eslam0ebrahem/Trackzoon`

### Step 3: Configure the Service
1. Railway will detect your project automatically
2. Go to **Settings** tab
3. Set **Start Command**: `node bot/index.js`
4. Set **Root Directory**: `/` (leave as default)

### Step 4: Add Environment Variables
Go to the **Variables** tab and add:

```
BOT_TOKEN=8329433130:AAH7g9a8F5zQHa9zDemIvcnx0GmkQq_bp-o
MONGODB_URI=mongodb+srv://eslam1v:2tPMAytvUxLwFlcy@cluster0.ksezl1d.mongodb.net/
```

### Step 5: Deploy
1. Click **"Deploy"** button
2. Wait 1-2 minutes for deployment to complete
3. Check **Logs** tab - you should see:
   ```
   Telegram bot initialized.
   Scheduler started
   Launching Trackzoon bot...
   MongoDB connected.
   Bot successfully launched!
   ```

### Step 6: Verify Bot is Working
1. Open Telegram and find your bot
2. Send `/start` command
3. Bot should respond immediately!

---

## Alternative: Deploy to Other Platforms

### Option B: Heroku (Paid - $5/month minimum)
1. Install Heroku CLI: `brew install heroku`
2. Login: `heroku login`
3. Create app: `heroku create trackzoon-bot`
4. Set vars: 
   ```bash
   heroku config:set BOT_TOKEN=your_token
   heroku config:set MONGODB_URI=your_mongo_uri
   ```
5. Deploy: `git push heroku main`

### Option C: Render.com (FREE)
1. Go to https://render.com
2. Create new **Background Worker**
3. Connect GitHub repo
4. Start command: `node bot/index.js`
5. Add environment variables
6. Deploy

### Option D: DigitalOcean App Platform ($5/month)
1. Go to https://cloud.digitalocean.com/apps
2. Create new app from GitHub
3. Select "Worker" type
4. Configure environment variables
5. Deploy

---

## Run Locally (For Testing)

### Quick Start:
```bash
npm run bot
```

### With environment file:
```bash
export $(cat .env.bot | xargs) && npm run bot
```

### Stop the bot:
Press `Ctrl+C`

---

## Monitoring Your Bot

### Check if bot is running:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"
```

### Check webhook status (should be empty):
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "url": "",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## Troubleshooting

### Bot not responding?
1. Check Railway logs for errors
2. Verify environment variables are set correctly
3. Check MongoDB connection string is valid
4. Ensure BOT_TOKEN is correct

### "Bot already started" error?
- This happens if webhook is still set
- Delete webhook: 
  ```bash
  curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
  ```

### Database connection errors?
- Check MONGODB_URI is correct
- Ensure your IP is whitelisted in MongoDB Atlas (or set to 0.0.0.0/0 for all IPs)

---

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Telegram      │◄────────┤  Railway.app     │
│   Servers       │         │  (Bot Server)    │
└─────────────────┘         │  - bot/index.js  │
                            │  - Schedulers    │
                            │  - Handlers      │
                            └────────┬─────────┘
                                     │
                                     │ MongoDB
                                     ▼
                            ┌──────────────────┐
                            │  MongoDB Atlas   │
                            │  (Database)      │
                            └────────┬─────────┘
                                     │
                                     │
                            ┌────────▼─────────┐
                            │   Vercel         │
                            │   (Web Dashboard)│
                            │   - Next.js UI   │
                            │   - Admin Panel  │
                            └──────────────────┘
```

---

## Cost Breakdown

- **Railway.app**: FREE ($5 monthly credit)
- **Vercel**: FREE (Hobby plan)
- **MongoDB Atlas**: FREE (512MB storage)

**Total: $0/month** 🎉

---

## Next Steps

1. Deploy bot to Railway.app
2. Keep Vercel for web dashboard
3. Both share the same MongoDB database
4. Bot handles Telegram messages + price checking
5. Dashboard shows data to admin

Your bot will run 24/7 without any code changes needed!
