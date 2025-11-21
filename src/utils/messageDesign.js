/**
 * Standardized message design utility
 * Enforces consistent formatting, headers, and footers across the bot
 */

export class MessageBuilder {
    constructor() {
        this.lines = [];
    }

    /**
     * Set the message header
     * @param {string} title - Title text
     * @param {string} icon - Emoji icon (optional)
     */
    setHeader(title, icon = '🤖') {
        this.lines.push(`${icon} *${title}*`);
        this.lines.push(''); // Empty line after header
        return this;
    }

    /**
     * Add a section header
     * @param {string} title - Section title
     */
    addSection(title) {
        if (this.lines.length > 0 && this.lines[this.lines.length - 1] !== '') {
            this.lines.push('');
        }
        this.lines.push(`*${title}*`);
        return this;
    }

    /**
     * Add a line of text
     * @param {string} text - Text content
     * @param {string} icon - Optional bullet point or icon
     */
    addLine(text, icon = '') {
        this.lines.push(`${icon ? icon + ' ' : ''}${text}`);
        return this;
    }

    /**
     * Add an empty line for spacing
     */
    addSpacer() {
        this.lines.push('');
        return this;
    }

    /**
     * Add a divider line
     */
    addDivider() {
        this.lines.push('━━━━━━━━━━━━━━━━━━━━');
        return this;
    }

    /**
     * Add an info/tip box
     * @param {string} text - Tip text
     */
    addTip(text) {
        this.addSpacer();
        this.lines.push(`💡 _${text}_`);
        return this;
    }

    /**
     * Build the final message string
     */
    toString() {
        return this.lines.join('\n');
    }
}

export const createHeader = (title) => `🤖 *${title}*`;
export const createFooter = () => `\n━━━━━━━━━━━━━━━━━━━━\n_Trackzoon - Your Price Tracker_`;
