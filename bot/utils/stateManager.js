import { EventEmitter } from 'events';
import { BotError, ErrorCodes } from './errorHandler.js';

export const BotStates = {
  IDLE: 'IDLE',
  ADDING_PRODUCT: 'ADDING_PRODUCT',
  WAITING_FOR_URL: 'WAITING_FOR_URL',
  WAITING_FOR_URL_AND_PRICE: 'WAITING_FOR_URL_AND_PRICE',
  WAITING_FOR_THRESHOLD: 'WAITING_FOR_THRESHOLD',
  SETTING_THRESHOLD: 'SETTING_THRESHOLD',
  AWAITING_PRICE_UPDATE_CONFIRMATION: 'AWAITING_PRICE_UPDATE_CONFIRMATION',
  REMOVING_PRODUCT: 'REMOVING_PRODUCT'
};

class StateManager extends EventEmitter {
  constructor() {
    super();
    this.states = new Map();
    this.timeouts = new Map();
    this.TIMEOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  }

  setState(chatId, state, data = {}) {
    const timestamp = Date.now();
    this.states.set(chatId, { state, data, timestamp });
    this._setStateTimeout(chatId);
    this.emit('stateChanged', { chatId, state, data });
  }

  getState(chatId) {
    const stateData = this.states.get(chatId);
    if (!stateData) return null;

    // Check for timeout
    if (Date.now() - stateData.timestamp > this.TIMEOUT_DURATION) {
      this.clearState(chatId);
      throw new BotError('State timeout', ErrorCodes.TIMEOUT_ERROR, 'Your session has expired. Please start over.');
    }

    return stateData;
  }

  updateState(chatId, newData) {
    const currentState = this.states.get(chatId);
    if (!currentState) return false;

    this.states.set(chatId, {
      ...currentState,
      data: { ...currentState.data, ...newData },
      timestamp: Date.now()
    });
    this._setStateTimeout(chatId);
    return true;
  }

  clearState(chatId) {
    if (this.timeouts.has(chatId)) {
      clearTimeout(this.timeouts.get(chatId));
      this.timeouts.delete(chatId);
    }
    
    const hadState = this.states.delete(chatId);
    if (hadState) {
      this.emit('stateCleared', chatId);
    }
    return hadState;
  }

  _setStateTimeout(chatId) {
    if (this.timeouts.has(chatId)) {
      clearTimeout(this.timeouts.get(chatId));
    }

    const timeout = setTimeout(() => {
      if (this.states.has(chatId)) {
        const state = this.states.get(chatId);
        this.clearState(chatId);
        this.emit('stateTimeout', { chatId, state });
      }
    }, this.TIMEOUT_DURATION);

    this.timeouts.set(chatId, timeout);
  }

  // Clean up old states periodically
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [chatId, state] of this.states.entries()) {
        if (now - state.timestamp > this.TIMEOUT_DURATION) {
          this.clearState(chatId);
        }
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }
}

export const stateManager = new StateManager();
stateManager.startCleanup();