import { DEV_MODE } from './constants.js';

class Logger {
  constructor(context = 'StepGallery') {
    this.context = context;
    this.isProduction = !DEV_MODE;
  }

  log(...args) {
    if (!this.isProduction) {
      console.log(`[${this.context}]`, ...args);
    }
  }

  info(...args) {
    if (!this.isProduction) {
      console.info(`[${this.context}]`, ...args);
    }
  }

  warn(...args) {
    console.warn(`[${this.context}]`, ...args);
  }

  error(...args) {
    console.error(`[${this.context}]`, ...args);
  }

  debug(...args) {
    if (!this.isProduction) {
      console.debug(`[${this.context}]`, ...args);
    }
  }

  group(label) {
    if (!this.isProduction) {
      console.group(`[${this.context}] ${label}`);
    }
  }

  groupEnd() {
    if (!this.isProduction) {
      console.groupEnd();
    }
  }

  time(label) {
    if (!this.isProduction) {
      console.time(`[${this.context}] ${label}`);
    }
  }

  timeEnd(label) {
    if (!this.isProduction) {
      console.timeEnd(`[${this.context}] ${label}`);
    }
  }
}

export { Logger };
export default Logger;
