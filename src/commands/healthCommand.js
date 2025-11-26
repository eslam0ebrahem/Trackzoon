import { handleError } from '../utils/errorHandler.js';
import mongoose from 'mongoose';
import os from 'os';

export default (bot) => {
    bot.command('health', async (ctx) => {
        // Admin check (replace with actual admin ID check if needed)
        // For now, open to all or check specific ID
        // const ADMIN_ID = 123456789;
        // if (ctx.from.id !== ADMIN_ID) return;

        try {
            const processingMsg = await ctx.reply('🏥 Checking system health...');

            // DB Status
            const dbState = mongoose.connection.readyState;
            const dbStatus = dbState === 1 ? '🟢 Connected' : dbState === 2 ? '🟡 Connecting' : '🔴 Disconnected';

            // System Stats
            const uptime = process.uptime();
            const uptimeHrs = (uptime / 3600).toFixed(2);
            const memUsage = process.memoryUsage();
            const memUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(0);
            const loadAvg = os.loadavg()[0].toFixed(2);

            // Queue/Job Stats (Mocked for now, or fetch from actual queue if available)
            // const activeJobs = ...

            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

            const message = [
                '🏥 *System Health Report*',
                '',
                `🖥️ *Server:*`,
                `• Uptime: ${uptimeHrs} hours`,
                `• Memory: ${memUsedMB} MB`,
                `• Load Avg: ${loadAvg}`,
                '',
                `🗄️ *Database:*`,
                `• Status: ${dbStatus}`,
                '',
                `🤖 *Bot:*`,
                `• Status: 🟢 Online`,
                `• Version: 1.0.0`
            ].join('\n');

            await ctx.reply(message, { parse_mode: 'Markdown' });

        } catch (error) {
            handleError(ctx, error);
        }
    });
};
