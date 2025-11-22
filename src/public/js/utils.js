import { CONFIG, STATE } from './config.js';

export function formatPrice(price) {
    if (STATE.currentCurrency === 'USD') {
        return `$${(price * CONFIG.EXCHANGE_RATE).toFixed(2)}`;
    }
    return `EGP ${price.toFixed(2)}`;
}

export function shareDeal(name, url, price) {
    const text = `🔥 Check out this deal!\n${name}\nPrice: EGP ${price}\n${url}`;
    if (navigator.share) {
        navigator.share({
            title: 'Trackzoon Deal',
            text: text,
            url: url
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(text).then(() => {
            alert('Deal copied to clipboard!');
        }).catch(console.error);
    }
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
