import axios from 'axios';

/**
 * Resolves shortened Amazon URLs and extracts the ASIN.
 * @param {string} url - The URL to resolve.
 * @returns {Promise<{resolvedUrl: string, asin: string|null}>} The resolved URL and ASIN.
 */
async function resolveAmazonUrl(url) {
  let resolvedUrl = url;
  if (url.includes('amzn.eu') || url.includes('amzn.to')) {
    const res = await axios.get(url);
    resolvedUrl = res.request.res.responseUrl;
  }

  // Extract ASIN from the resolved URL
  const asinMatch = resolvedUrl.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
  const asin = asinMatch ? asinMatch[1] : null;

  return { resolvedUrl, asin };
}

export { resolveAmazonUrl };