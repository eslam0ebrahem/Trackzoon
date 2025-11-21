export const parseAmazonUrl = (url) => {
    if (!url) return null;

    try {
        // Clean the URL
        url = url.trim();
        if (url.includes('[') && url.includes(']')) {
            const match = url.match(/\[.*\]\((.*?)\)/);
            if (match) url = match[1];
        }

        // Basic URL validation
        if (!validateUrl(url)) return null;

        // Extract ASIN - support multiple URL patterns
        const patterns = [
            /\/dp\/([A-Z0-9]{10})/i,
            /\/product\/([A-Z0-9]{10})/i,
            /\/gp\/product\/([A-Z0-9]{10})/i,
            /\/?[A-Z0-9]{10}/i
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return {
                    asin: match[1].toUpperCase(),
                    url: url
                };
            }
        }
    } catch (error) {
        console.error('Error parsing Amazon URL:', error);
    }
    
    return null;
};

export const validateUrl = (url) => {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};