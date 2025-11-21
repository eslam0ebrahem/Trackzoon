import axios from 'axios';
import cache, { CacheKeys, CacheTTL } from '../config/cache.js';

/**
 * Cleans an Amazon URL by removing query parameters and tracking codes
 * @param {string} url - The URL to clean
 * @returns {string} The cleaned URL
 */
export function cleanAmazonUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Keep only the pathname (removes all query parameters)
    const cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    
    // Remove trailing slash if present
    return cleanUrl.endsWith('/') ? cleanUrl.slice(0, -1) : cleanUrl;
  } catch (error) {
    console.error('Error cleaning URL:', error);
    return url; // Return original URL if parsing fails
  }
}

/**
 * Resolves shortened Amazon URLs and extracts the ASIN.
 * @param {string} url - The URL to resolve.
 * @returns {Promise<{resolvedUrl: string, asin: string|null}>} The resolved URL and ASIN.
 */
export async function resolveAmazonUrl(url) {
  try {
    console.log('\nProcessing URL:', url);

    // Try cache first
    const cacheKey = CacheKeys.resolvedUrl(url);
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log('Cache hit: Resolved URL');
      return cached;
    }

    // Clean the URL first
    let cleanUrl = url.trim();
    console.log('Cleaned URL:', cleanUrl);
    
    // Handle mobile URLs
    if (cleanUrl.startsWith('m.')) {
      cleanUrl = cleanUrl.replace('m.', 'www.');
    }

    // Add https if protocol is missing
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    console.log('Normalized URL:', cleanUrl);

    // For amzn.eu URLs, handle directly without resolving
    const shortCodeMatch = cleanUrl.match(/amzn\.eu\/d\/([a-zA-Z0-9]{10})/i);
    if (shortCodeMatch) {
      const shortCode = shortCodeMatch[1].toUpperCase();
      console.log('Found Amazon short code:', shortCode);
      return {
        resolvedUrl: cleanAmazonUrl(cleanUrl),
        asin: shortCode
      };
    }

    // For standard URLs, try to extract ASIN
    const standardPatterns = [
      /(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i,  // Standard product URLs
      /\/([A-Z0-9]{10})(?:\/|\?|$)/i,                   // URLs ending with ASIN
    ];

    for (const pattern of standardPatterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1].length === 10) {
        const asin = match[1].toUpperCase();
        console.log('Found standard ASIN:', asin);
        return {
          resolvedUrl: cleanAmazonUrl(cleanUrl),
          asin: asin
        };
      }
    }

    // If no patterns matched, try to resolve shortened URL
    if (cleanUrl.includes('amzn.') || cleanUrl.includes('amazon.')) {
      try {
        console.log('Attempting to resolve URL...');
        const res = await axios.get(cleanUrl, {
          maxRedirects: 5,
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          },
          validateStatus: function (status) {
            return status >= 200 && status < 400;
          }
        });
        
        const resolvedUrl = res.request.res.responseUrl;
        console.log('Resolved to:', resolvedUrl);

        // Try to extract ASIN from resolved URL
        for (const pattern of standardPatterns) {
          const match = resolvedUrl.match(pattern);
          if (match && match[1].length === 10) {
            const asin = match[1].toUpperCase();
            console.log('Found ASIN from resolved URL:', asin);
            const result = {
              resolvedUrl: cleanAmazonUrl(resolvedUrl),
              asin: asin
            };
            // Cache the resolved URL
            await cache.set(cacheKey, result, CacheTTL.RESOLVED_URL);
            return result;
          }
        }
      } catch (error) {
        console.log('Failed to resolve URL:', error.message);
      }
    }

    // If we got here, we couldn't find a valid ASIN
    console.log('No valid ASIN found');
    const result = {
      resolvedUrl: cleanAmazonUrl(cleanUrl),
      asin: null
    };
    // Cache even null results to avoid repeated resolution attempts
    await cache.set(cacheKey, result, 3600); // 1 hour for failed resolutions
    return result;
  } catch (error) {
    console.error('Error in resolveAmazonUrl:', error);
    return {
      resolvedUrl: cleanAmazonUrl(url),
      asin: null
    };
  }
}