# Deployment Checklist - New Features

## ✅ Pre-Deployment Checks

### Code Quality
- [x] All syntax errors fixed
- [x] All files pass `node --check`
- [x] No linting errors
- [x] Imports properly structured

### Files Created (7 new files)
- [x] `bot/commands/chartCommand.js`
- [x] `bot/commands/savingsCommand.js`
- [x] `bot/commands/flashDealsCommand.js`
- [x] `bot/services/flashDealDetector.js`
- [x] `bot/services/ratingScraper.js`
- [x] `NEW_FEATURES.md`
- [x] `QUICK_REFERENCE.md`

### Files Modified (7 files)
- [x] `bot/handlers.js` - Added 3 new commands
- [x] `bot/utils/chartGenerator.js` - Enhanced
- [x] `bot/models/User.js` - Added savings schema
- [x] `bot/models/Product.js` - Added rating & flash deal fields
- [x] `bot/utils/messageHelper.js` - Added ratings & sendMessage
- [x] `bot/services/priceTrackerService.js` - Added imports
- [x] `bot/actions/productActions.js` - Added action handlers

### Dependencies
- [x] QuickChart.js (already installed in package.json)
- [x] No new dependencies needed

## 🚀 Deployment Steps

### 1. Test Locally (Optional)
```bash
# Start MongoDB
brew services start mongodb-community

# Set environment variables
export BOT_TOKEN="your_bot_token"
export MONGODB_URI="mongodb://localhost:27017/trackzoon"

# Run bot
npm start
```

### 2. Test Commands Locally
- [ ] `/chart` - Test with product that has history
- [ ] `/chart` - Test with new product (no history)
- [ ] `/savings` - Test with user who has no savings
- [ ] `/flashdeals` - Test (likely no active deals initially)

### 3. Commit Changes
```bash
git add .
git commit -m "feat: Add price charts, flash deals, savings tracker, and ratings

- Added /chart command with beautiful price history visualization
- Added /flashdeals command for >20% price drops in 24h
- Added /savings command to track total savings
- Added automatic product ratings from Amazon
- Enhanced message helpers with rating display
- Updated help command with new features
- Created comprehensive documentation"
```

### 4. Push to Repository
```bash
git push origin main
```

### 5. Railway Auto-Deploy
- Railway will automatically detect the push
- Monitor deployment logs at https://railway.app
- Check for any build/deployment errors

### 6. Post-Deployment Verification
- [ ] Bot starts successfully (check Railway logs)
- [ ] No crash loops
- [ ] MongoDB connection established
- [ ] All commands respond
- [ ] Test new features in production

## 🧪 Testing Checklist (Production)

### Command Tests
- [ ] `/start` - Ensure bot responds
- [ ] `/help` - Verify new commands listed
- [ ] `/chart` - Test chart generation
- [ ] `/savings` - Check savings display
- [ ] `/flashdeals` - Verify flash deal detection
- [ ] `/list` - Verify ratings show in product lists

### Feature Tests
- [ ] Add a product and wait for price check
- [ ] Verify ratings are scraped (check logs)
- [ ] Simulate 20%+ price drop to test flash deal alert
- [ ] Check if savings are tracked when price drops
- [ ] Verify charts show proper data

### Performance Tests
- [ ] Chart generation time (<3 seconds)
- [ ] No timeouts on commands
- [ ] Rating scraper doesn't block price checks
- [ ] Flash deal detection doesn't slow down bot

### Error Handling
- [ ] Test `/chart` with invalid ASIN
- [ ] Test commands with no products tracked
- [ ] Test flash deals with no active deals
- [ ] Test savings with $0 total

## 📊 Monitoring

### Logs to Watch
```bash
# Railway logs
railway logs

# Look for:
✅ "Scanning for flash deals..."
✅ "Updated rating for [product]"
✅ "Flash deal detected"
✅ "Chart generation successful"

# Watch for errors:
❌ "Error scraping product rating"
❌ "Chart generation failed"
❌ "Flash deal notification failed"
```

### Key Metrics
- [ ] Bot uptime: Should be 100%
- [ ] Command response time: <2s
- [ ] Chart generation success rate: >95%
- [ ] Rating scrape success rate: >80%
- [ ] Flash deal detection: Check hourly

## 🐛 Common Issues & Fixes

### Issue: "bot is not defined"
**Cause:** Commands defined outside `registerHandlers` function
**Status:** ✅ FIXED (moved commands inside function)

### Issue: Charts not generating
**Possible Causes:**
- QuickChart.js API down (check status)
- Invalid price history data
- Network timeout

**Fix:**
- Add retry logic
- Check price history data structure
- Increase timeout

### Issue: Ratings not showing
**Possible Causes:**
- Amazon blocking scraper
- Selector changes on Amazon
- Rate limiting

**Fix:**
- Check scraper selectors
- Add more delay between requests
- Use proxy if needed

### Issue: Flash deals not detecting
**Possible Causes:**
- Not enough price history (need 24h)
- No products with >20% drop
- Cooldown active

**Fix:**
- Wait for more price checks
- Lower threshold for testing
- Check product price history

### Issue: Savings not tracking
**Possible Causes:**
- User schema not migrated
- Flash deal detector not integrated
- Price drop logic issue

**Fix:**
- Check User model has savings field
- Verify flash deal integration
- Check logs for errors

## 📈 Success Metrics

### Day 1
- [ ] 0 crashes
- [ ] All commands responding
- [ ] At least 1 chart generated
- [ ] At least 1 rating scraped

### Week 1
- [ ] 10+ charts generated
- [ ] 5+ flash deals detected
- [ ] Ratings on 50%+ of products
- [ ] User engagement with new features

### Month 1
- [ ] High user satisfaction
- [ ] Feature adoption rate >60%
- [ ] 0 critical bugs
- [ ] Performance metrics stable

## 🎉 Launch Announcement

### Message for Users
```
🎉 BIG UPDATE! 🎉

Your Amazon Price Tracker just got SUPER POWERED!

✨ NEW FEATURES:

📊 /chart - Beautiful price history charts
⚡ /flashdeals - Catch massive >20% drops
💰 /savings - Track your total savings
⭐ Ratings - See product quality instantly

🚀 Try them now and save even more money!

Type /help to see all new commands.
```

## 📞 Rollback Plan (If Needed)

### If critical issues occur:
```bash
# Revert to previous commit
git log --oneline -5  # Find previous commit
git revert <commit-hash>
git push origin main

# Or rollback in Railway dashboard
# Go to Deployments → Select previous deployment → Redeploy
```

### Files to revert if partial rollback needed:
- `bot/handlers.js` - Remove new commands
- `bot/models/` - Revert schema changes (safe, backwards compatible)
- `bot/actions/productActions.js` - Remove new actions

## ✅ Sign-Off

- [ ] All pre-deployment checks passed
- [ ] Code reviewed
- [ ] Tests completed
- [ ] Documentation updated
- [ ] Ready to deploy

**Deployed by:** ________________
**Date:** November 15, 2025
**Version:** 2.0.0

---

**Note:** This deployment adds NO breaking changes. All new features are additive and backwards compatible with existing data.
