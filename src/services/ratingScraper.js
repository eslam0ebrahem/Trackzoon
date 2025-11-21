/**
 * Rating Scraper Service
 * Scrapes product ratings and review counts from Amazon
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

/**
 * Get random user agent
 */
const getRandomUserAgent = () => {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
};

/**
 * Scrape product rating from Amazon
 */
export const scrapeProductRating = async (url) => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Try multiple selectors for rating
    let rating = null;
    let reviewCount = 0;

    // Method 1: Star rating span
    const ratingText1 = $('span[data-hook="rating-out-of-text"]').first().text().trim();
    if (ratingText1) {
      const match = ratingText1.match(/(\d+\.?\d*)\s*out of/i);
      if (match) {
        rating = parseFloat(match[1]);
      }
    }

    // Method 2: Star rating from class
    if (!rating) {
      const ratingText2 = $('i[data-hook="average-star-rating"] span.a-icon-alt').first().text().trim();
      if (ratingText2) {
        const match = ratingText2.match(/(\d+\.?\d*)\s*out of/i);
        if (match) {
          rating = parseFloat(match[1]);
        }
      }
    }

    // Method 3: Customer review average
    if (!rating) {
      const ratingText3 = $('#acrPopover').attr('title');
      if (ratingText3) {
        const match = ratingText3.match(/(\d+\.?\d*)\s*out of/i);
        if (match) {
          rating = parseFloat(match[1]);
        }
      }
    }

    // Get review count
    const reviewText1 = $('span[data-hook="total-review-count"]').first().text().trim();
    if (reviewText1) {
      reviewCount = parseInt(reviewText1.replace(/[,\s]/g, ''), 10) || 0;
    }

    // Alternative review count selector
    if (!reviewCount) {
      const reviewText2 = $('#acrCustomerReviewText').first().text().trim();
      if (reviewText2) {
        const match = reviewText2.match(/(\d+[\d,]*)\s*ratings?/i);
        if (match) {
          reviewCount = parseInt(match[1].replace(/,/g, ''), 10) || 0;
        }
      }
    }

    return {
      rating: rating || 0,
      reviewCount: reviewCount || 0,
      success: rating !== null
    };

  } catch (error) {
    console.error('Error scraping product rating:', error.message);
    return {
      rating: 0,
      reviewCount: 0,
      success: false,
      error: error.message
    };
  }
};

/**
 * Update product rating in database
 */
export const updateProductRating = async (product) => {
  try {
    // Don't update if recently updated (within last 7 days)
    if (product.rating?.lastUpdated) {
      const daysSinceUpdate = (Date.now() - product.rating.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) {
        return product.rating;
      }
    }

    const ratingData = await scrapeProductRating(product.url);
    
    if (ratingData.success) {
      product.rating = {
        stars: ratingData.rating,
        count: ratingData.reviewCount,
        lastUpdated: new Date()
      };
      await product.save();
      console.log(`✅ Updated rating for ${product.name}: ${ratingData.rating}⭐ (${ratingData.reviewCount} reviews)`);
    }

    return product.rating;

  } catch (error) {
    console.error('Error updating product rating:', error);
    return product.rating || { stars: 0, count: 0 };
  }
};

/**
 * Get rating emoji
 */
export const getRatingEmoji = (stars) => {
  if (stars >= 4.5) return '🌟'; // Excellent
  if (stars >= 4.0) return '⭐'; // Very good
  if (stars >= 3.5) return '✨'; // Good
  if (stars >= 3.0) return '💫'; // Average
  return '⚠️'; // Below average
};

/**
 * Format rating display
 */
export const formatRating = (rating) => {
  if (!rating || !rating.stars) {
    return 'No rating';
  }

  const emoji = getRatingEmoji(rating.stars);
  const reviewText = rating.count > 0 
    ? `${rating.count.toLocaleString()} review${rating.count !== 1 ? 's' : ''}`
    : 'No reviews';

  return `${emoji} ${rating.stars.toFixed(1)}/5.0 (${reviewText})`;
};

/**
 * Bulk update ratings for multiple products
 */
export const bulkUpdateRatings = async (products) => {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0
  };

  for (const product of products) {
    try {
      // Check if update needed
      if (product.rating?.lastUpdated) {
        const daysSinceUpdate = (Date.now() - product.rating.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 7) {
          results.skipped++;
          continue;
        }
      }

      const rating = await updateProductRating(product);
      if (rating?.stars > 0) {
        results.success++;
      } else {
        results.failed++;
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`Error updating rating for ${product.name}:`, error);
      results.failed++;
    }
  }

  return results;
};

export default {
  scrapeProductRating,
  updateProductRating,
  getRatingEmoji,
  formatRating,
  bulkUpdateRatings
};
