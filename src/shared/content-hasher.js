import { Logger } from './logger.js';

const logger = new Logger('ContentHasher');

export class ContentHasher {
  constructor(options = {}) {
    this.lookbackSize = options.lookbackSize || 10;
    this.hashHistory = [];
  }

  async hashContent(content) {
    const text = typeof content === 'string' ? content : this.extractText(content);
    return await this.sha256(text);
  }

  extractText(element) {
    if (!element) return '';
    
    if (typeof element === 'string') {
      return element;
    }
    
    if (element instanceof HTMLElement) {
      return element.textContent || element.innerText || '';
    }
    
    if (Array.isArray(element)) {
      return element.map(el => this.extractText(el)).join('|');
    }
    
    return String(element);
  }

  async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  async isRecentDuplicate(content) {
    const hash = await this.hashContent(content);
    const isDuplicate = this.hashHistory.includes(hash);
    
    if (!isDuplicate) {
      this.hashHistory.push(hash);
      
      if (this.hashHistory.length > this.lookbackSize) {
        this.hashHistory.shift();
      }
    }
    
    return isDuplicate;
  }

  isDuplicate(hash) {
    return this.hashHistory.includes(hash);
  }

  addHash(hash) {
    if (!this.hashHistory.includes(hash)) {
      this.hashHistory.push(hash);
      
      if (this.hashHistory.length > this.lookbackSize) {
        this.hashHistory.shift();
      }
    }
  }

  clear() {
    this.hashHistory = [];
    logger.log('Hash history cleared');
  }

  getHistory() {
    return [...this.hashHistory];
  }
}

export default ContentHasher;
