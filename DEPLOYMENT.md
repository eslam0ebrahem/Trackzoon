# Trackzoon - Vercel Deployment Guide

This guide will help you deploy your Trackzoon project to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. A MongoDB Atlas account (for production database)
3. A Telegram Bot Token
4. Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Prepare Your Repository

Make sure all your changes are committed and pushed to your Git repository:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

## Step 2: Set Up MongoDB Atlas (Production Database)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free tier is available)
3. Create a database user with read/write permissions
4. Whitelist all IP addresses (0.0.0.0/0) for Vercel
5. Get your connection string (it should look like):
   ```
   mongodb+srv://username:password@cluster.mongodb.net/trackzoon?retryWrites=true&w=majority
   ```

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Configure your project:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

## Step 4: Configure Environment Variables

In your Vercel project settings, add the following environment variables:

### Required Variables:

1. **MONGODB_URI**
   - Your MongoDB Atlas connection string
   - Example: `mongodb+srv://user:pass@cluster.mongodb.net/trackzoon`

2. **BOT_TOKEN**
   - Your Telegram Bot Token from BotFather
   - Example: `8329433130:AAH7g9a8F5zQHa9zDemIvcnx0GmkQq_bp-o`

3. **NEXTAUTH_SECRET**
   - Generate a secure random string
   - Run: `openssl rand -base64 32`
   - Example: `your-generated-secret-here`

4. **NEXTAUTH_URL**
   - Your Vercel deployment URL
   - Example: `https://your-app.vercel.app`

5. **ADMIN_USERNAME**
   - Your admin dashboard username
   - Example: `admin`

6. **ADMIN_PASSWORD**
   - Your admin dashboard password (use a strong password!)
   - Example: `your-secure-password`

7. **WEBHOOK_URL**
   - Your webhook endpoint URL
   - Example: `https://your-app.vercel.app/api/bot/webhook`

### How to Add Environment Variables in Vercel:

1. Go to your project in Vercel Dashboard
2. Click "Settings"
3. Click "Environment Variables"
4. Add each variable with its value
5. Make sure to select the appropriate environments (Production, Preview, Development)

## Step 5: Set Up Telegram Webhook

After your first deployment is complete:

1. Visit: `https://your-app.vercel.app/api/bot/set-webhook` (POST request)
   
   Or use curl:
   ```bash
   curl -X POST https://your-app.vercel.app/api/bot/set-webhook
   ```

2. Verify webhook is set:
   ```bash
   curl https://your-app.vercel.app/api/bot/set-webhook
   ```

## Step 6: Test Your Deployment

1. **Test the Web Dashboard**:
   - Visit: `https://your-app.vercel.app`
   - Try logging in with your admin credentials

2. **Test the Telegram Bot**:
   - Open Telegram and message your bot
   - Try commands like `/start`

3. **Check Logs**:
   - Go to Vercel Dashboard → Your Project → Logs
   - Monitor for any errors

## Important Notes

### Bot Architecture on Vercel

⚠️ **Important**: Vercel uses serverless functions, so the traditional long-polling bot approach won't work. Your bot now uses webhooks:

- Telegram sends updates to: `https://your-app.vercel.app/api/bot/webhook`
- Each message triggers a serverless function
- No persistent connections or background processes

### Limitations

1. **Serverless Function Timeout**: Max 10 seconds for hobby plan, 60 seconds for pro
2. **No Background Jobs**: The scheduler in `bot/scheduler/index.js` won't work on Vercel
3. **Cold Starts**: First request after inactivity may be slower

### Alternative for Scheduled Tasks

For price tracking and scheduled tasks, consider:

1. **Vercel Cron Jobs** (Pro plan): Add to `vercel.json`:
   ```json
   {
     "crons": [{
       "path": "/api/cron/check-prices",
       "schedule": "0 */6 * * *"
     }]
   }
   ```

2. **External Cron Service**: Use services like:
   - [Cron-job.org](https://cron-job.org)
   - [EasyCron](https://www.easycron.com)
   - [AWS EventBridge](https://aws.amazon.com/eventbridge/)

   Configure them to hit: `https://your-app.vercel.app/api/admin/trigger-price-update`

## Troubleshooting

### Build Fails

- Check Vercel build logs
- Ensure all dependencies are in `package.json`
- Verify TypeScript compilation succeeds locally: `npm run build`

### Bot Not Responding

- Verify webhook is set: Visit `/api/bot/set-webhook`
- Check environment variables are set correctly
- Review function logs in Vercel Dashboard

### Database Connection Issues

- Verify MongoDB Atlas connection string
- Ensure IP whitelist includes `0.0.0.0/0`
- Check database user permissions

### Authentication Issues

- Verify `NEXTAUTH_SECRET` is set
- Verify `NEXTAUTH_URL` matches your domain
- Clear browser cookies and try again

## Post-Deployment

### Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update `NEXTAUTH_URL` and `WEBHOOK_URL` to use your custom domain
5. Reset the Telegram webhook with the new URL

### Monitoring

- Use Vercel Analytics to monitor performance
- Set up alerts for errors in Vercel Dashboard
- Monitor MongoDB Atlas metrics

## Updating Your Deployment

Vercel automatically deploys when you push to your repository:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

For immediate deployment:
```bash
vercel --prod
```

## Security Checklist

- ✅ Environment variables are set in Vercel (not in code)
- ✅ `.env` files are in `.gitignore`
- ✅ Strong admin password is used
- ✅ MongoDB Atlas network access is configured
- ✅ NEXTAUTH_SECRET is a strong random string

## Support

If you encounter issues:

1. Check Vercel documentation: [vercel.com/docs](https://vercel.com/docs)
2. Check Next.js documentation: [nextjs.org/docs](https://nextjs.org/docs)
3. Review logs in Vercel Dashboard

## Additional Resources

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [MongoDB Atlas Setup](https://docs.atlas.mongodb.com/getting-started/)
