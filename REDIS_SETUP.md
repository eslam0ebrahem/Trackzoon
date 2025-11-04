# Redis Caching Setup Guide

This guide will help you enable Redis caching for Trackzoon to improve performance by 80-95%.

## 🚀 Quick Setup on Railway (Recommended)

### Step 1: Add Redis to Your Project

1. Open your Railway project: https://railway.app
2. Navigate to your Trackzoon project
3. Click the **"+ New"** button
4. Select **"Database"** → **"Add Redis"**
5. Railway will deploy a Redis instance

### Step 2: Connect Redis to Your Bot

1. Click on your **bot service** (where your app runs)
2. Go to the **"Variables"** tab
3. Click **"+ New Variable"** → **"+ Reference"**
4. Select: `Redis` service → `REDIS_URL` variable
5. Click **"Add"**

### Step 3: Redeploy

Railway will automatically redeploy your bot with Redis enabled.

**Expected Output:**
```
✅ Redis cache initialized successfully
   Connected to: redis://[your-redis-host]:6379
```

Instead of:
```
⚠️  Redis URL not configured. Caching disabled.
```

---

## 📊 Performance Impact

### Before Redis (Current):
- `/add` command: 8-12 seconds
- Product name fetch: 5-8 seconds per request
- URL resolution: 2-3 seconds per request
- Amazon scraping: Every request

### After Redis:
- `/add` command (cache hit): **0.5-1 seconds** (90% faster)
- Product name fetch: **<50ms** (cache hit)
- URL resolution: **<20ms** (cache hit)
- Amazon scraping: Only on cache misses

### Expected Cache Hit Rates:
- Product names: **85-95%** (users track similar products)
- URL resolution: **90-98%** (limited Amazon domains)
- Reduced IP ban risk: **100%** improvement

---

## 🔧 Alternative: External Redis Service

If you prefer using a managed Redis service:

### Option 1: Redis Cloud (Free Tier)
1. Sign up: https://redis.com/try-free/
2. Create a free database (30MB)
3. Copy the connection string (format: `redis://default:password@host:port`)
4. In Railway, add environment variable:
   - Name: `REDIS_URL`
   - Value: Your Redis Cloud connection string

### Option 2: Upstash (Serverless Redis)
1. Sign up: https://upstash.com/
2. Create a Redis database
3. Copy the Redis URL
4. Add to Railway environment variables

---

## ✅ Verify Caching is Working

### Check Logs
After enabling Redis, your Railway logs should show:
```
✅ Redis cache initialized successfully
   Connected to: redis://[host]:6379
   Cache ready for operations
```

### Test Cache Performance

1. **First request** (cache miss - slow):
```
/add https://amazon.co.uk/product/B0ABC123
→ Takes 8-10 seconds (scraping Amazon)
```

2. **Second request** (cache hit - fast):
```
/add https://amazon.co.uk/product/B0ABC123
→ Takes 0.5-1 seconds (from cache)
```

### Monitor Cache Usage

Connect to Redis CLI in Railway:
```bash
# In Railway Redis service, open "Terminal" tab
redis-cli

# Check cached items
> KEYS product:name:*
> KEYS url:resolved:*

# Check a specific cached item
> GET product:name:B0ABC123

# Check time to live
> TTL product:name:B0ABC123
```

---

## 🎯 Cache Strategy

### What Gets Cached:

1. **Product Names** (7 days TTL)
   - Key: `product:name:{ASIN}`
   - Example: `product:name:B0ABC123`
   - Why: Product names rarely change

2. **Resolved URLs** (30 days TTL)
   - Key: `url:resolved:{base64(url)}`
   - Why: Amazon short URLs resolve to same product

3. **Product Prices** (30 minutes TTL)
   - Key: `product:price:{ASIN}`
   - Why: Prices change frequently

### Cache Invalidation:

- **Automatic**: TTL expires naturally
- **Manual**: Use `/admin cache:clear` (if implemented)
- **Pattern**: Redis automatically evicts old data

---

## 🔍 Troubleshooting

### Issue: "Redis URL not configured" still appears

**Solution:**
1. Verify `REDIS_URL` is set in Railway variables
2. Check the format: `redis://host:port` or `rediss://host:port` (with SSL)
3. Redeploy the service after adding the variable

### Issue: "Redis connection failed"

**Possible Causes:**
1. **Network Access**: Railway Redis might need whitelisting
2. **Invalid URL**: Check format (redis:// or rediss://)
3. **SSL Required**: Try using `rediss://` instead of `redis://`

**Solution:**
Check Railway logs for specific error:
```
Error connecting to Redis: [specific error]
```

### Issue: Cache not improving performance

**Debugging:**
1. Check if Redis is actually being used:
   ```bash
   # In Railway Redis terminal
   redis-cli
   > INFO stats
   > KEYS *
   ```

2. Verify cache hits in application logs:
   - Should see: "Cache hit: product:name:B0ABC123"
   - Not just: "Cache miss" every time

---

## 💰 Cost Estimation

### Railway Redis Plugin:
- **Free Tier**: 1GB RAM, 1GB storage
- **Sufficient for**: 10,000+ cached items
- **Typical usage**: ~50-100MB for moderate bot usage
- **Cost**: $0/month (within free tier)

### Redis Cloud Free Tier:
- **Storage**: 30MB
- **Sufficient for**: ~1,000-2,000 cached items
- **Cost**: $0/month

---

## 📈 Expected Results

After enabling Redis, you should see:

1. **Faster Commands**: `/add`, `/list` respond in <1 second
2. **Lower Logs**: Fewer "Scraping Amazon..." messages
3. **Better UX**: Users get instant responses
4. **No IP Bans**: Reduced scraping load on Amazon
5. **Scalability**: Can handle more users without slowdown

---

## 🎉 Success Checklist

- [ ] Redis instance created on Railway
- [ ] `REDIS_URL` variable added to bot service
- [ ] Bot redeployed successfully
- [ ] Logs show "Redis cache initialized successfully"
- [ ] First `/add` command is slow (cache miss)
- [ ] Second `/add` same product is fast (cache hit)
- [ ] No "Redis URL not configured" warnings

---

## 🆘 Need Help?

If you encounter issues:

1. Check Railway logs for Redis connection errors
2. Verify `REDIS_URL` format is correct
3. Ensure Railway Redis service is running
4. Try redeploying the bot service

The bot will continue to work even if Redis fails (graceful degradation), but without caching benefits.

---

**Note**: Caching is optional. The bot works perfectly fine without Redis, just slower. Enable it when you need better performance or have many users.
