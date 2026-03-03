import { UserService } from '../services/userService.js';
import { stateManager } from '../utils/stateManager.js';
import { handleError } from '../utils/errorHandler.js';

export const attachUser = async (ctx, next) => {
  try {
    if (ctx.chat && ctx.chat.id) {
      const user = await UserService.getOrCreateUser(ctx.chat.id);
      ctx.user = user;
    }
    return next();
  } catch (error) {
    return handleError(ctx, error);
  }
};

export const attachState = async (ctx, next) => {
  try {
    const state = stateManager.getState(ctx.chat.id);
    ctx.state.conversation = state || { state: 'IDLE', data: {} };
    return next();
  } catch (error) {
    return handleError(ctx, error);
  }
};

export const errorHandler = async (ctx, next) => {
  try {
    return await next();
  } catch (error) {
    return handleError(ctx, error);
  }
};

export const timeoutHandler = async (ctx, next) => {
  let timeoutId;
  try {
    const result = await Promise.race([
      next(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Operation timed out')), 30000);
      })
    ]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    return handleError(ctx, error, 'operationTimeout');
  }
};