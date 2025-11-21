/**
 * Universal Pagination Utility
 */

const ITEMS_PER_PAGE = 5;

/**
 * Paginate any array of items
 * @param {Array} items - Array of items to paginate
 * @param {number} page - Current page (1-indexed)
 * @param {number} perPage - Items per page
 * @returns {Object} Pagination result
 */
export const paginateItems = (items, page = 1, perPage = ITEMS_PER_PAGE) => {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / perPage);

  // Ensure page is within valid range
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));

  const startIndex = (currentPage - 1) * perPage;
  const endIndex = Math.min(startIndex + perPage, totalItems);

  const pageItems = items.slice(startIndex, endIndex);

  return {
    items: pageItems,
    currentPage,
    totalPages,
    totalItems,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    startIndex,
    endIndex
  };
};

/**
 * Create pagination keyboard buttons
 * @param {number} currentPage - Current page
 * @param {number} totalPages - Total pages
 * @param {string} callbackPrefix - Callback data prefix (e.g., 'list_page')
 * @returns {Array} Inline keyboard array
 */
export const createPaginationKeyboard = (currentPage, totalPages, callbackPrefix) => {
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
    callback_data: 'pagination_info' // No-op callback
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

export default {
  paginateItems,
  createPaginationKeyboard,
  ITEMS_PER_PAGE
};
