import axios from 'axios';

/**
 * Resolves shortened Amazon URLs (amzn.eu, amzn.to) to their full URL.
 * @param {string} url - The URL to resolve.
 * @returns {Promise<string>} The resolved URL.
 */
async function resolveAmazonUrl(url) {
  if (url.includes('amzn.eu') || url.includes('amzn.to')) {
    const res = await axios.get(url);
    return res.request.res.responseUrl;
  }
  return url;
}

export { resolveAmazonUrl };