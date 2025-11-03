/**
 * Pagination utility for product lists
 */

const PRODUCTS_PER_PAGE = 5;

/**
 * Paginate an array of products
 * @param {Array} products - Array of products
 * @param {number} page - Current page (1-indexed)
 * @param {number} perPage - Items per page
 * @returns {Object} Pagination result
 */
export const paginateProducts = (products, page = 1, perPage = PRODUCTS_PER_PAGE) => {
  const totalItems = products.length;
  const totalPages = Math.ceil(totalItems / perPage);
  
  // Ensure page is within valid range
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));
  
  const startIndex = (currentPage - 1) * perPage;
  const endIndex = startIndex + perPage;
  
  const items = products.slice(startIndex, endIndex);
  
  return {
    items,
    currentPage,
    totalPages,
    totalItems,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    startIndex,
    endIndex: Math.min(endIndex, totalItems)
  };
};

/**
 * Create pagination keyboard buttons
 * @param {number} currentPage - Current page
 * @param {number} totalPages - Total pages
 * @param {string} callbackPrefix - Callback data prefix (e.g., 'list_page')
 * @returns {Array} Inline keyboard array
 */
export const createPaginationKeyboard = (currentPage, totalPages, callbackPrefix = 'list_page') => {
  if (totalPages <= 1) {
    return [];
  }
  
  const buttons = [];
  
  // Previous button
  if (currentPage > 1) {
    buttons.push({
      text: '⬅️ Previous',
      callback_data: `${callbackPrefix}_${currentPage - 1}`
    });
  }
  
  // Page indicator
  buttons.push({
    text: `📄 ${currentPage}/${totalPages}`,
    callback_data: 'pagination_info'
  });
  
  // Next button
  if (currentPage < totalPages) {
    buttons.push({
      text: 'Next ➡️',
      callback_data: `${callbackPrefix}_${currentPage + 1}`
    });
  }
  
  return [buttons];
};

/**
 * Build paginated product list message
 * @param {Array} products - All products
 * @param {number} chatId - User's chat ID
 * @param {number} page - Current page
 * @param {Function} formatProductLine - Function to format each product line
 * @param {Function} escapeMarkdownV2 - Function to escape markdown
 * @returns {Object} Message and pagination info
 */
export const buildPaginatedProductList = (
  products, 
  chatId, 
  page, 
  formatProductLine,
  escapeMarkdownV2
) => {
  if (!products || products.length === 0) {
    return {
      message: '🔍 *No products tracked yet*\n\nUse /add to start tracking your first product\\.',
      pagination: null
    };
  }

  const { items, currentPage, totalPages, totalItems, hasNextPage, hasPrevPage, startIndex, endIndex } = 
    paginateProducts(products, page);

  let message = `📋 *Your Tracked Products*\n\n`;
  message += `_Showing ${startIndex + 1}\\-${endIndex} of ${totalItems}_\n\n`;
  
  // Group paginated products by status
  const belowThreshold = [];
  const aboveThreshold = [];
  
  items.forEach((p, idx) => {
    const actualIndex = startIndex + idx;
    const tracker = Array.isArray(p.trackedBy) ? p.trackedBy.find(t => t.chatId === chatId) : null;
    if (tracker && p.currentPrice <= tracker.thresholdPrice) {
      belowThreshold.push({ p, idx: actualIndex });
    } else {
      aboveThreshold.push({ p, idx: actualIndex });
    }
  });

  // Add deals section
  if (belowThreshold.length > 0) {
    message += '🌟 *Current Deals*\n';
    belowThreshold.forEach(({ p, idx }) => {
      const tracker = p.trackedBy.find(t => t.chatId === chatId);
      message += formatProductLine(idx + 1, p, tracker, true) + '\n\n';
    });
  }

  // Add other products
  if (aboveThreshold.length > 0) {
    if (belowThreshold.length > 0) {
      message += '\n📌 *Other Products*\n';
    }
    aboveThreshold.forEach(({ p, idx }) => {
      const tracker = p.trackedBy.find(t => t.chatId === chatId);
      message += formatProductLine(idx + 1, p, tracker, true) + '\n\n';
    });
  }

  // Add page navigation info
  if (totalPages > 1) {
    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📄 Page ${currentPage} of ${totalPages}`;
  }

  // Add summary
  message += `\n\n📊 *Total Summary:*\n`;
  message += `• All Products: ${totalItems}\n`;
  const allBelowThreshold = products.filter(p => {
    const tracker = Array.isArray(p.trackedBy) ? p.trackedBy.find(t => t.chatId === chatId) : null;
    return tracker && p.currentPrice <= tracker.thresholdPrice;
  });
  message += `• Current Deals: ${allBelowThreshold.length}\n`;
  message += `• Above Target: ${totalItems - allBelowThreshold.length}`;

  return {
    message,
    pagination: {
      currentPage,
      totalPages,
      totalItems,
      hasNextPage,
      hasPrevPage,
      items
    }
  };
};

export default {
  paginateProducts,
  createPaginationKeyboard,
  buildPaginatedProductList,
  PRODUCTS_PER_PAGE
};
