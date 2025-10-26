import { Logger } from './logger.js';

const logger = new Logger('InputSanitizer');

export class InputSanitizer {
  constructor(options = {}) {
    this.options = {
      maxSelectorLength: options.maxSelectorLength || 10000,
      allowedSelectorChars: options.allowedSelectorChars || /^[a-zA-Z0-9\s\-_#.\[\]=:()>+~*,"'|^$]+$/,
      allowedProtocols: options.allowedProtocols || ['http:', 'https:'],
      maxUrlLength: options.maxUrlLength || 2048,
      maxFilenameLength: options.maxFilenameLength || 255,
      allowedFilenameChars: options.allowedFilenameChars || /^[a-zA-Z0-9\-_. ()]+$/,
      escapeHtml: options.escapeHtml !== false,
      ...options
    };

    this.dangerousPatterns = {
      selector: [
        /<script/i,
        /javascript:/i,
        /on\w+=/i,
        /eval\(/i,
        /expression\(/i,
        /<iframe/i,
        /<embed/i,
        /<object/i
      ],
      url: [
        /javascript:/i,
        /data:text\/html/i,
        /vbscript:/i,
        /file:/i,
        /<script/i,
        /on\w+=/i
      ],
      path: [
        /\.\./,
        /\/\.\./,
        /\.\.[\\/]/,
        /^[\\\/]/
      ]
    };

    this.stats = {
      selectorsProcessed: 0,
      urlsProcessed: 0,
      filenamesProcessed: 0,
      htmlProcessed: 0,
      threatsBlocked: 0
    };
  }

  sanitizeSelector(selector, options = {}) {
    this.stats.selectorsProcessed++;

    try {
      if (!selector || typeof selector !== 'string') {
        return '';
      }

      selector = selector.trim();

      if (selector.length === 0) {
        return '';
      }

      if (selector.length > this.options.maxSelectorLength) {
        logger.warn('Selector exceeds maximum length:', selector.length);
        this.stats.threatsBlocked++;
        return '';
      }

      for (const pattern of this.dangerousPatterns.selector) {
        if (pattern.test(selector)) {
          logger.warn('Dangerous pattern detected in selector:', pattern);
          this.stats.threatsBlocked++;
          return '';
        }
      }

      if (!this.options.allowedSelectorChars.test(selector)) {
        logger.warn('Selector contains invalid characters');
        this.stats.threatsBlocked++;
        return '';
      }

      return selector;
    } catch (error) {
      logger.error('Error sanitizing selector:', error);
      return '';
    }
  }

  sanitizeUrl(url, options = {}) {
    this.stats.urlsProcessed++;

    try {
      if (!url || typeof url !== 'string') {
        return '';
      }

      url = url.trim();

      if (url.length === 0) {
        return '';
      }

      if (url.length > this.options.maxUrlLength) {
        logger.warn('URL exceeds maximum length:', url.length);
        this.stats.threatsBlocked++;
        return '';
      }

      for (const pattern of this.dangerousPatterns.url) {
        if (pattern.test(url)) {
          logger.warn('Dangerous pattern detected in URL:', pattern);
          this.stats.threatsBlocked++;
          return '';
        }
      }

      try {
        const urlObj = new URL(url);
        
        if (!this.options.allowedProtocols.includes(urlObj.protocol)) {
          logger.warn('URL protocol not allowed:', urlObj.protocol);
          this.stats.threatsBlocked++;
          return '';
        }

        return urlObj.href;
      } catch (e) {
        if (url.startsWith('/') || url.startsWith('./')) {
          return url;
        }
        
        logger.warn('Invalid URL format:', url);
        this.stats.threatsBlocked++;
        return '';
      }
    } catch (error) {
      logger.error('Error sanitizing URL:', error);
      return '';
    }
  }

  sanitizeFilename(filename, options = {}) {
    this.stats.filenamesProcessed++;

    try {
      if (!filename || typeof filename !== 'string') {
        return 'file';
      }

      filename = filename.trim();

      if (filename.length === 0) {
        return 'file';
      }

      for (const pattern of this.dangerousPatterns.path) {
        if (pattern.test(filename)) {
          logger.warn('Path traversal attempt detected in filename');
          this.stats.threatsBlocked++;
          filename = filename.replace(pattern, '');
        }
      }

      filename = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

      if (filename.length > this.options.maxFilenameLength) {
        const ext = filename.split('.').pop();
        const base = filename.substring(0, this.options.maxFilenameLength - ext.length - 1);
        filename = `${base}.${ext}`;
      }

      return filename || 'file';
    } catch (error) {
      logger.error('Error sanitizing filename:', error);
      return 'file';
    }
  }

  escapeHtml(html) {
    this.stats.htmlProcessed++;

    if (!html || typeof html !== 'string') {
      return '';
    }

    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  getStats() {
    return { ...this.stats };
  }

  resetStats() {
    this.stats = {
      selectorsProcessed: 0,
      urlsProcessed: 0,
      filenamesProcessed: 0,
      htmlProcessed: 0,
      threatsBlocked: 0
    };
  }
}

export default InputSanitizer;
