/**
 * HTML Cleaner Utility
 * Ported from CyberScraper-2077 (src/web_extractor.py)
 * 
 * Preprocesses HTML content to reduce token usage for AI analysis.
 * Removes scripts, styles, comments, and empty tags.
 */

import * as cheerio from 'cheerio';

// Tags to remove
const REMOVE_TAGS = ['script', 'style', 'header', 'footer', 'nav', 'aside', 'iframe', 'noscript', 'svg'];

/**
 * Clean HTML content for AI consumption
 * @param {string} html - Raw HTML content
 * @returns {string} - Cleaned text content
 */
export function cleanHtml(html) {
    if (!html) return '';

    const $ = cheerio.load(html);

    // 1. Remove unwanted tags
    REMOVE_TAGS.forEach(tag => {
        $(tag).remove();
    });

    // 2. Remove comments (Cheerio doesn't have a direct 'remove comments' but we can iterate)
    // In simple node traversal, comments are nodes of type 'comment'. 
    // For AI context, script/style removal is most critical.

    // 3. Get text content
    let text = $('body').text();

    // 4. Cleanup Whitespace (mimicking the Python generator logic)
    // Split by lines, trim each line
    const lines = text.split('\n').map(line => line.trim());

    // Split lines by double spaces to catch inline chunks, filter empty
    const chunks = lines
        .flatMap(line => line.split('  ').map(chunk => chunk.trim()))
        .filter(chunk => chunk.length > 0);

    return chunks.join('\n');
}
