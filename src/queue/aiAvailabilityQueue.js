import { Queue } from 'bullmq';
import { logger } from '../utils/logger.js';

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

export const aiAvailabilityQueue = new Queue('ai-availability-queue', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200
  }
});

aiAvailabilityQueue.on('error', (err) => {
  logger.warn(`AI Queue Error: ${err.message}`);
});

export const scheduleAiAvailabilityCheck = async ({ asin, url, reason }) => {
  if (!asin || !url) return false;
  try {
    const jobId = `ai-avail-${asin}-${Math.floor(Date.now() / (60 * 60 * 1000))}`;
    await aiAvailabilityQueue.add('ai-availability', { asin, url, reason }, { jobId });
    return true;
  } catch (error) {
    logger.warn(`AI availability scheduling failed: ${error.message}`);
    return false;
  }
};
