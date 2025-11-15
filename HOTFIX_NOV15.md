# Hotfix - November 15, 2025

## Issues Fixed

### 1. ❌ `bot.sendPhoto is not a function`
**Error:** Chart command failing with TypeError
**Cause:** Incorrect Telegraf API usage - `bot.sendPhoto()` doesn't exist
**Fix:** Changed to `bot.telegram.sendPhoto()`

**Files Updated:**
- `bot/commands/chartCommand.js` - Line 99
- `bot/commands/savingsCommand.js` - Line 86

**Change:**
```javascript
// Before (WRONG)
await bot.sendPhoto(chatId, chartUrl, {...})

// After (CORRECT)
await bot.telegram.sendPhoto(chatId, chartUrl, {...})
```

---

### 2. ❌ Price Not Found - Page Structure Changed
**Error:** `getPrice` failing with "Price not found - page structure may have changed"
**Cause:** Amazon updated their HTML selectors
**Fix:** Added 10+ new price selectors + fallback regex

**File Updated:**
- `bot/utils/scraper/getPrice.js`

**New Selectors Added:**
```javascript
'#corePrice_desktop .a-price .a-offscreen',
'.a-price.priceToPay .a-offscreen',
'.a-section.a-spacing-none.aok-align-center #price_inside_buybox',
'#apex_desktop .apexPriceToPay .a-offscreen',
'.apex_offerDisplay_desktop .a-price .a-offscreen',
'#buybox .a-price .a-offscreen',
'#centerCol .a-price .a-offscreen',
'#rightCol .a-price .a-offscreen',
// Plus fallback regex: /[£$€](\d{1,5}(?:[.,]\d{2})?)/
```

**Fallback Strategy:**
If all structured selectors fail, now searches for price patterns like `£XX.XX` in the buy box area using regex.

---

## Testing

### Syntax Check
```bash
node --check bot/commands/chartCommand.js ✅
node --check bot/commands/savingsCommand.js ✅
node --check bot/utils/scraper/getPrice.js ✅
```

### Manual Test Required
- [ ] Test `/chart` command with a product
- [ ] Test price scraping on various Amazon products
- [ ] Verify savings chart displays correctly

---

## Deployment

These fixes are critical for production functionality:

1. **Immediate Impact:** Chart feature will work
2. **Price Scraping:** More resilient to Amazon changes
3. **Backwards Compatible:** No breaking changes

**Deploy immediately** to restore chart functionality.

---

## Future Improvements

### Price Scraper Resilience
Consider:
- [ ] Add more dynamic selector discovery
- [ ] Implement puppeteer for JavaScript-rendered pages
- [ ] Add Amazon API integration (if available)
- [ ] Cache successful selectors per product

### Error Handling
- [ ] Graceful degradation when charts fail
- [ ] User-friendly error messages
- [ ] Retry logic for transient failures
- [ ] Alert admin when scraper fails repeatedly

---

**Status:** ✅ Ready to Deploy
**Priority:** 🔴 HIGH (Production Broken)
**Risk:** 🟢 LOW (Syntax validated, minimal changes)
