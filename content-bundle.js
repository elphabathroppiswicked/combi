(function() {
  'use strict';

  // ===== src/shared/constants.js =====
  const VERSION = '3.0.0';

  const DEV_MODE = (() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        const url = chrome.runtime.getURL('');
        return url.includes('localhost') || url.includes('dev');
      }
    } catch (e) {}
    return false;
  })();

  const FEATURES = {
    DEBUG_PANEL: DEV_MODE,
    VERBOSE_LOGGING: DEV_MODE,
    PERFORMANCE_PROFILING: DEV_MODE
  };

  const PAGINATION_CONFIG = {
    MAX_PAGES: 50,
    MAX_ATTEMPTS: 50,
    WAIT_AFTER_CLICK: 2000,
    WAIT_FOR_CONTENT: 1500,
    SCROLL_DELAY: 500,
    DUPLICATE_CHECK_LOOKBACK: 10
  };

  const EXPORT_CONFIG = {
    MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
    BATCH_SIZE: 100,
    COMPRESSION_LEVEL: 6,
    STREAMING_THRESHOLD: 500,
    LARGE_DATASET_THRESHOLD: 1000
  };

  const DOWNLOAD_CONFIG = {
    CONCURRENT_DOWNLOADS: 3,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
  };

  const MESSAGE_TYPES = {
    CORE_INIT: 'core/init',
    CORE_GALLERY_DETECTED: 'core/gallery-detected',
    CORE_IMAGES_FOUND: 'core/images-found',
    CORE_PAGINATION_START: 'core/pagination-start',
    CORE_PAGINATION_STOP: 'core/pagination-stop',
    CORE_PAGINATION_STATUS: 'core/pagination-status',

    EXPORT_CSV: 'export/csv',
    EXPORT_XLSX: 'export/xlsx',
    EXPORT_JSON: 'export/json',
    EXPORT_HTML: 'export/html',

    DOWNLOAD_START: 'download/start',
    DOWNLOAD_PROGRESS: 'download/progress',
    DOWNLOAD_COMPLETE: 'download/complete',
    DOWNLOAD_BATCH_CONFIRM: 'download/batch-confirm',

    SETTINGS_UPDATE: 'settings/update',
    SETTINGS_GET: 'settings/get',

    GET_IMAGES: 'get/images',
    CLEAR_IMAGES: 'clear/images',

    API_ENDPOINT_DETECTED: 'api/endpoint-detected',
    API_RESPONSE_CAPTURED: 'api/response-captured'
  };

  const DEFAULT_SETTINGS = {
    autoDownload: false,
    downloadFolder: '',
    filenamePattern: '*num-3*-*name*.*ext*',
    paginationMethod: 'auto',
    galleryAutoDetect: true,
    maxPages: 50,
    concurrentDownloads: 3,
    paginationDelay: 2,
    scrollDelay: 500,
    batchSize: 0,
    downloadDelay: 0,
    exportFormats: ['csv'],
    exportFields: ['filename', 'fileUrl', 'dimensions', 'sourcePage']
  };


  // ===== src/shared/logger.js =====
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



  // ===== src/shared/input-sanitizer.js =====
  class InputSanitizer {
    constructor(options = {}) {
      this.logger = new Logger('InputSanitizer');
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
          this.logger.warn('Selector exceeds maximum length:', selector.length);
          this.stats.threatsBlocked++;
          return '';
        }

        for (const pattern of this.dangerousPatterns.selector) {
          if (pattern.test(selector)) {
            this.logger.warn('Dangerous pattern detected in selector:', pattern);
            this.stats.threatsBlocked++;
            return '';
          }
        }

        if (!this.options.allowedSelectorChars.test(selector)) {
          this.logger.warn('Selector contains invalid characters');
          this.stats.threatsBlocked++;
          return '';
        }

        return selector;
      } catch (error) {
        this.logger.error('Error sanitizing selector:', error);
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
          this.logger.warn('URL exceeds maximum length:', url.length);
          this.stats.threatsBlocked++;
          return '';
        }

        for (const pattern of this.dangerousPatterns.url) {
          if (pattern.test(url)) {
            this.logger.warn('Dangerous pattern detected in URL:', pattern);
            this.stats.threatsBlocked++;
            return '';
          }
        }

        try {
          const urlObj = new URL(url);

          if (!this.options.allowedProtocols.includes(urlObj.protocol)) {
            this.logger.warn('URL protocol not allowed:', urlObj.protocol);
            this.stats.threatsBlocked++;
            return '';
          }

          return urlObj.href;
        } catch (e) {
          if (url.startsWith('/') || url.startsWith('./')) {
            return url;
          }

          this.logger.warn('Invalid URL format:', url);
          this.stats.threatsBlocked++;
          return '';
        }
      } catch (error) {
        this.logger.error('Error sanitizing URL:', error);
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
            this.logger.warn('Path traversal attempt detected in filename');
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
        this.logger.error('Error sanitizing filename:', error);
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



  // ===== src/shared/content-hasher.js =====
  class ContentHasher {
    constructor(options = {}) {
      this.logger = new Logger('ContentHasher');
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
      this.logger.log('Hash history cleared');
    }

    getHistory() {
      return [...this.hashHistory];
    }
  }



  // ===== src/content/network-monitor.js =====
  class NetworkMonitor {
    constructor(options = {}) {
      this.logger = new Logger('NetworkMonitor');
      this.capturedResponses = [];
      this.latestPaginationInfo = null;
      this.detectedEndpoints = [];
      this.isInjected = false;
    }

    inject() {
      if (this.isInjected) {
        this.logger.debug('Network monitor already injected');
        return;
      }

      const script = document.createElement('script');
      script.textContent = `
        (function() {
          const originalFetch = window.fetch;
          const originalXHROpen = XMLHttpRequest.prototype.open;
          const originalXHRSend = XMLHttpRequest.prototype.send;

          window.fetch = async function(...args) {
            const response = await originalFetch.apply(this, args);
            const clonedResponse = response.clone();

            try {
              const url = typeof args[0] === 'string' ? args[0] : args[0].url;
              const contentType = clonedResponse.headers.get('content-type');

              if (contentType && contentType.includes('application/json')) {
                const data = await clonedResponse.json();
                window.postMessage({
                  type: 'STEPGALLERY_API_RESPONSE',
                  url: url,
                  data: data
                }, '*');
              }
            } catch (e) {
              console.debug('StepGallery: Error intercepting fetch response:', e);
            }

            return response;
          };

          XMLHttpRequest.prototype.open = function(method, url) {
            this._stepgalleryUrl = url;
            this._stepgalleryMethod = method;
            return originalXHROpen.apply(this, arguments);
          };

          XMLHttpRequest.prototype.send = function() {
            const xhr = this;

            xhr.addEventListener('load', function() {
              try {
                const contentType = xhr.getResponseHeader('content-type');
                if (contentType && contentType.includes('application/json')) {
                  const data = JSON.parse(xhr.responseText);
                  window.postMessage({
                    type: 'STEPGALLERY_API_RESPONSE',
                    url: xhr._stepgalleryUrl,
                    data: data
                  }, '*');
                }
              } catch (e) {
                console.debug('StepGallery: Error intercepting XHR response:', e);
              }
            });

            return originalXHRSend.apply(this, arguments);
          };

          console.log('StepGallery: Network monitoring initialized');
        })();
      `;

      (document.head || document.documentElement).appendChild(script);
      script.remove();

      this.isInjected = true;
      this.logger.log('Network monitor injected');

      this.setupListener();
    }

    setupListener() {
      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data.type === 'STEPGALLERY_API_RESPONSE') {
          this.handleAPIResponse(event.data);
        }
      });
    }

    handleAPIResponse(response) {
      this.capturedResponses.push(response);

      const { url, data } = response;

      if (!this.detectedEndpoints.includes(url)) {
        this.detectedEndpoints.push(url);
        this.logger.log('API endpoint detected:', url);

        try {
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.API_ENDPOINT_DETECTED,
            endpoint: url
          }).catch(err => this.logger.debug('Error sending API endpoint:', err));
        } catch (error) {
          this.logger.debug('Error notifying API endpoint:', error);
        }
      }

      const paginationInfo = this.extractPaginationInfo(data);
      if (paginationInfo) {
        this.latestPaginationInfo = { ...paginationInfo, endpoint: url };
        this.logger.log('Pagination info extracted:', this.latestPaginationInfo);
      }

      const imageUrls = this.extractImageUrlsFromJSON(data);
      if (imageUrls.length > 0) {
        this.logger.log(`Found ${imageUrls.length} images in API response`);

        try {
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.API_RESPONSE_CAPTURED,
            url: url,
            imageCount: imageUrls.length,
            paginationInfo: paginationInfo
          }).catch(err => this.logger.debug('Error sending API response:', err));
        } catch (error) {
          this.logger.debug('Error notifying API response:', error);
        }
      }
    }

    extractPaginationInfo(data) {
      const info = {
        nextPage: null,
        nextUrl: null,
        nextCursor: null,
        nextToken: null
      };

      if (!data || typeof data !== 'object') {
        return null;
      }

      const checkKeys = (obj, keys) => {
        for (const key of keys) {
          if (obj[key]) return obj[key];
        }
        return null;
      };

      info.nextUrl = checkKeys(data, ['next', 'nextPage', 'next_page', 'nextUrl', 'next_url']);

      if (data.pagination) {
        info.nextUrl = info.nextUrl || checkKeys(data.pagination, ['next', 'nextUrl', 'next_url']);
        info.nextPage = info.nextPage || data.pagination.nextPage || data.pagination.next_page;
      }

      if (data.paging) {
        info.nextUrl = info.nextUrl || checkKeys(data.paging, ['next', 'nextUrl']);

        if (data.paging.cursors) {
          info.nextCursor = data.paging.cursors.after || data.paging.cursors.next;
        }
      }

      info.nextCursor = info.nextCursor || checkKeys(data, ['cursor', 'nextCursor', 'next_cursor']);
      info.nextToken = checkKeys(data, ['token', 'nextToken', 'next_token', 'pageToken', 'page_token']);

      if (data.links && Array.isArray(data.links)) {
        const nextLink = data.links.find(link => link.rel === 'next' || link.relation === 'next');
        if (nextLink) {
          info.nextUrl = nextLink.href || nextLink.url;
        }
      }

      const hasAnyPaginationInfo = info.nextUrl || info.nextCursor || info.nextToken || info.nextPage;

      return hasAnyPaginationInfo ? info : null;
    }

    extractImageUrlsFromJSON(data, results = [], visited = new WeakSet()) {
      if (!data || typeof data !== 'object') {
        return results;
      }

      if (visited.has(data)) {
        return results;
      }
      visited.add(data);

      if (Array.isArray(data)) {
        data.forEach(item => this.extractImageUrlsFromJSON(item, results, visited));
        return results;
      }

      const imageKeys = [
        'url', 'image', 'imageUrl', 'image_url', 'src', 'source',
        'thumbnail', 'thumbnailUrl', 'thumbnail_url', 'preview',
        'fullImage', 'full_image', 'original', 'large', 'medium'
      ];

      for (const key of imageKeys) {
        if (data[key] && typeof data[key] === 'string') {
          const url = data[key];
          if (this.isImageUrl(url)) {
            results.push(url);
          }
        }
      }

      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'object' && data[key] !== null) {
          this.extractImageUrlsFromJSON(data[key], results, visited);
        }
      });

      return results;
    }

    isImageUrl(url) {
      if (typeof url !== 'string' || url.length < 10) {
        return false;
      }

      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
      const lowerUrl = url.toLowerCase();

      if (imageExtensions.some(ext => lowerUrl.includes(ext))) {
        return true;
      }

      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
        if (lowerUrl.includes('/image/') || lowerUrl.includes('/img/') || lowerUrl.includes('/photo/')) {
          return true;
        }
      }

      return false;
    }

    getLatestPaginationInfo() {
      return this.latestPaginationInfo;
    }

    getCapturedResponses() {
      return this.capturedResponses;
    }

    clear() {
      this.capturedResponses = [];
      this.latestPaginationInfo = null;
      this.logger.log('Network monitor cleared');
    }
  }



  // ===== src/content/image-extractor.js =====
  class ImageExtractor {
    constructor(options = {}) {
      this.logger = new Logger('ImageExtractor');
      this.minWidth = options.minWidth || 100;
      this.minHeight = options.minHeight || 100;
      this.sanitizer = new InputSanitizer();
      this.extractedUrls = new Set();
      this.pageNumber = 1;
      this.lazyLoadObserver = null;
      this.observedImages = new Set();
      this.lazyLoadedImages = new Set();
    }

    async extractImages() {
      const images = [];

      const imgElements = document.querySelectorAll('img');
      imgElements.forEach(img => {
        const imageData = this.extractFromImgTag(img);
        if (imageData && !this.extractedUrls.has(imageData.fileUrl)) {
          images.push(imageData);
          this.extractedUrls.add(imageData.fileUrl);
        }
      });

      const lazyImages = document.querySelectorAll('[data-src], [data-lazy], [data-original], [data-srcset]');
      lazyImages.forEach(el => {
        const imageData = this.extractFromLazyElement(el);
        if (imageData && !this.extractedUrls.has(imageData.fileUrl)) {
          images.push(imageData);
          this.extractedUrls.add(imageData.fileUrl);
        }
      });

      const bgImages = this.extractBackgroundImages();
      bgImages.forEach(imageData => {
        if (!this.extractedUrls.has(imageData.fileUrl)) {
          images.push(imageData);
          this.extractedUrls.add(imageData.fileUrl);
        }
      });

      const linkImages = this.extractFromLinks();
      linkImages.forEach(imageData => {
        if (!this.extractedUrls.has(imageData.fileUrl)) {
          images.push(imageData);
          this.extractedUrls.add(imageData.fileUrl);
        }
      });

      this.logger.log(`Extracted ${images.length} images from page ${this.pageNumber}`);

      if (images.length > 0) {
        this.notifyImagesFound(images);
      }

      return images;
    }

    extractFromImgTag(img) {
      try {
        const src = img.src || img.dataset.src || img.dataset.lazy || img.dataset.original;

        if (!src || src.length < 10) return null;

        if (src.startsWith('data:')) return null;

        const sanitizedUrl = this.sanitizer.sanitizeUrl(src);
        if (!sanitizedUrl) return null;

        if (img.naturalWidth && img.naturalHeight) {
          if (img.naturalWidth < this.minWidth || img.naturalHeight < this.minHeight) {
            return null;
          }
        }

        const fullUrl = sanitizedUrl.startsWith('http') ? sanitizedUrl : new URL(sanitizedUrl, window.location.href).href;

        const filename = this.extractFilename(fullUrl);
        const caption = img.alt || img.title || '';
        const dimensions = `${img.naturalWidth || '?'}x${img.naturalHeight || '?'}`;

        return {
          filename: this.sanitizer.sanitizeFilename(filename),
          fileUrl: fullUrl,
          thumbnailUrl: fullUrl,
          caption: caption,
          dimensions: dimensions,
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0,
          sourcePage: window.location.href,
          pageNumber: this.pageNumber,
          extractedAt: new Date().toISOString()
        };
      } catch (error) {
        this.logger.error('Error extracting from img tag:', error);
        return null;
      }
    }

    extractFromLazyElement(el) {
      try {
        const src = el.dataset.src || el.dataset.lazy || el.dataset.original || 
                    el.dataset.lazySrc || el.dataset.srcset;

        if (!src || src.length < 10) return null;

        if (src.startsWith('data:')) return null;

        let imageUrl = src;
        if (src.includes(',')) {
          imageUrl = src.split(',')[0].trim().split(' ')[0];
        }

        const sanitizedUrl = this.sanitizer.sanitizeUrl(imageUrl);
        if (!sanitizedUrl) return null;

        const fullUrl = sanitizedUrl.startsWith('http') ? sanitizedUrl : new URL(sanitizedUrl, window.location.href).href;

        const filename = this.extractFilename(fullUrl);
        const caption = el.alt || el.title || el.getAttribute('aria-label') || '';

        return {
          filename: this.sanitizer.sanitizeFilename(filename),
          fileUrl: fullUrl,
          thumbnailUrl: fullUrl,
          caption: caption,
          dimensions: 'lazy-loaded',
          width: 0,
          height: 0,
          sourcePage: window.location.href,
          pageNumber: this.pageNumber,
          extractedAt: new Date().toISOString()
        };
      } catch (error) {
        this.logger.error('Error extracting from lazy element:', error);
        return null;
      }
    }

    extractBackgroundImages() {
      const images = [];
      const allElements = document.querySelectorAll('*');

      allElements.forEach(el => {
        try {
          const style = window.getComputedStyle(el);
          const bgImage = style.backgroundImage;

          if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {
            const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (urlMatch && urlMatch[1]) {
              const url = urlMatch[1];

              if (url.length < 10 || url.startsWith('data:')) return;

              const sanitizedUrl = this.sanitizer.sanitizeUrl(url);
              if (!sanitizedUrl) return;

              const fullUrl = sanitizedUrl.startsWith('http') ? sanitizedUrl : new URL(sanitizedUrl, window.location.href).href;

              const filename = this.extractFilename(fullUrl);
              const caption = el.getAttribute('aria-label') || el.title || '';

              const rect = el.getBoundingClientRect();
              if (rect.width < this.minWidth || rect.height < this.minHeight) {
                return;
              }

              images.push({
                filename: this.sanitizer.sanitizeFilename(filename),
                fileUrl: fullUrl,
                thumbnailUrl: fullUrl,
                caption: caption,
                dimensions: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                sourcePage: window.location.href,
                pageNumber: this.pageNumber,
                extractedAt: new Date().toISOString(),
                type: 'background'
              });
            }
          }
        } catch (error) {
          this.logger.debug('Error extracting background image:', error);
        }
      });

      return images;
    }

    extractFromLinks() {
      const images = [];
      const links = document.querySelectorAll('a[href]');

      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

      links.forEach(link => {
        try {
          const href = link.href;

          if (imageExtensions.some(ext => href.toLowerCase().includes(ext))) {
            const sanitizedUrl = this.sanitizer.sanitizeUrl(href);
            if (!sanitizedUrl) return;

            const filename = this.extractFilename(sanitizedUrl);
            const caption = link.textContent.trim() || link.title || link.getAttribute('aria-label') || '';

            images.push({
              filename: this.sanitizer.sanitizeFilename(filename),
              fileUrl: sanitizedUrl,
              thumbnailUrl: sanitizedUrl,
              caption: caption,
              dimensions: 'unknown',
              width: 0,
              height: 0,
              sourcePage: window.location.href,
              pageNumber: this.pageNumber,
              extractedAt: new Date().toISOString(),
              type: 'linked'
            });
          }
        } catch (error) {
          this.logger.debug('Error extracting from link:', error);
        }
      });

      return images;
    }

    /**
     * Triggers native lazy loading by scrolling through the page using IntersectionObserver.
     * This is a more robust approach than just looking for data-src attributes.
     * @param {Object} options - Configuration options
     * @param {number} options.scrollDelay - Delay between scroll steps in ms (default: 500)
     * @param {number} options.maxScrollSteps - Maximum number of scroll steps (default: 20)
     * @returns {Promise<void>}
     */
    async triggerLazyLoading(options = {}) {
      const scrollDelay = options.scrollDelay || 500;
      const maxScrollSteps = options.maxScrollSteps || 20;

      this.logger.log('Starting lazy loading trigger with IntersectionObserver');

      // Initialize IntersectionObserver if not already done
      this.initializeLazyLoadObserver();

      // Find all images on the page
      const allImages = document.querySelectorAll('img');

      // Observe all images
      allImages.forEach(img => {
        if (!this.observedImages.has(img)) {
          this.lazyLoadObserver.observe(img);
          this.observedImages.add(img);
        }
      });

      // Scroll through the page to trigger lazy loading
      await this.scrollToTriggerLazyLoad(scrollDelay, maxScrollSteps);

      this.logger.log(`Lazy loading triggered, ${this.lazyLoadedImages.size} images loaded`);
    }

    /**
     * Initialize the IntersectionObserver for detecting lazy-loaded images
     */
    initializeLazyLoadObserver() {
      if (this.lazyLoadObserver) {
        return;
      }

      const observerOptions = {
        root: null,
        rootMargin: '50px',
        threshold: 0.01
      };

      this.lazyLoadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;

            // Track that this image entered the viewport
            if (!this.lazyLoadedImages.has(img)) {
              this.lazyLoadedImages.add(img);

              // Monitor for src attribute changes
              this.monitorImageSrcChange(img);
            }
          }
        });
      }, observerOptions);

      this.logger.debug('IntersectionObserver initialized for lazy loading');
    }

    /**
     * Monitor an image element for src attribute changes (when lazy loading populates it)
     * @param {HTMLImageElement} img - The image element to monitor
     */
    monitorImageSrcChange(img) {
      // If image already has a src, nothing to do
      if (img.src && !img.src.startsWith('data:') && img.src.length > 10) {
        return;
      }

      // Use MutationObserver to detect when src is populated
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
            const newSrc = img.src;
            if (newSrc && !newSrc.startsWith('data:') && newSrc.length > 10) {
              this.logger.debug(`Lazy-loaded image src populated: ${newSrc.substring(0, 50)}...`);
              observer.disconnect();
            }
          }
        });
      });

      observer.observe(img, {
        attributes: true,
        attributeFilter: ['src']
      });

      // Disconnect after 10 seconds to avoid memory leaks
      setTimeout(() => observer.disconnect(), 10000);
    }

    /**
     * Scroll through the page gradually to trigger lazy loading
     * @param {number} scrollDelay - Delay between scroll steps in ms
     * @param {number} maxScrollSteps - Maximum number of scroll steps
     * @returns {Promise<void>}
     */
    async scrollToTriggerLazyLoad(scrollDelay, maxScrollSteps) {
      const scrollHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      const viewportHeight = window.innerHeight;
      const scrollStep = viewportHeight * 0.75; // Scroll 75% of viewport each time
      let currentScroll = window.scrollY;
      let steps = 0;

      // Save original scroll position
      const originalScroll = currentScroll;

      while (currentScroll < scrollHeight - viewportHeight && steps < maxScrollSteps) {
        // Scroll down
        currentScroll += scrollStep;
        window.scrollTo({
          top: currentScroll,
          behavior: 'smooth'
        });

        // Wait for images to load
        await this.waitForContent(scrollDelay);

        steps++;
      }

      // Restore original scroll position
      window.scrollTo({
        top: originalScroll,
        behavior: 'smooth'
      });

      // Wait for scroll to complete
      await this.waitForContent(300);

      this.logger.debug(`Completed ${steps} scroll steps to trigger lazy loading`);
    }

    /**
     * Extract images after triggering lazy loading
     * This combines the new IntersectionObserver approach with the existing data-src fallback
     * @param {Object} options - Configuration options
     * @returns {Promise<Array>} Array of extracted images
     */
    async extractImagesWithLazyLoading(options = {}) {
      // First, trigger lazy loading by scrolling
      await this.triggerLazyLoading(options);

      // Then extract images normally (now with populated src attributes)
      return await this.extractImages();
    }

    /**
     * Helper to wait for a specified time
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise<void>}
     */
    waitForContent(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    extractFilename(url) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const parts = pathname.split('/');
        let filename = parts[parts.length - 1];

        if (!filename || filename.length === 0) {
          filename = 'image.jpg';
        }

        const queryIndex = filename.indexOf('?');
        if (queryIndex !== -1) {
          filename = filename.substring(0, queryIndex);
        }

        if (!filename.includes('.')) {
          filename += '.jpg';
        }

        return filename;
      } catch (error) {
        return 'image.jpg';
      }
    }

    incrementPage() {
      this.pageNumber++;
    }

    reset() {
      this.extractedUrls.clear();
      this.pageNumber = 1;
      this.observedImages.clear();
      this.lazyLoadedImages.clear();

      // Disconnect and cleanup the IntersectionObserver
      if (this.lazyLoadObserver) {
        this.lazyLoadObserver.disconnect();
        this.lazyLoadObserver = null;
      }
    }

    notifyImagesFound(images) {
      try {
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.CORE_IMAGES_FOUND,
          images: images
        }).catch(err => this.logger.debug('Error sending images found:', err));
      } catch (error) {
        this.logger.debug('Error notifying images found:', error);
      }
    }
  }



  // ===== src/content/gallery-detector.js =====
  class GalleryDetector {
    constructor(options = {}) {
      this.logger = new Logger('GalleryDetector');
      this.minImagesForGallery = options.minImagesForGallery || 10;
      this.imageToTextRatioThreshold = options.imageToTextRatioThreshold || 0.3;
    }

    async detectGallery() {
      this.logger.log('Starting gallery detection');

      const detection = {
        isGallery: false,
        galleryType: 'unknown',
        imageCount: 0,
        confidence: 0,
        paginationMethods: [],
        gridLayout: false
      };

      const images = this.findImages();
      detection.imageCount = images.length;

      if (images.length < this.minImagesForGallery) {
        this.logger.log(`Not enough images (${images.length}) for gallery detection`);
        return detection;
      }

      const imageToTextRatio = this.calculateImageToTextRatio(images);
      this.logger.log(`Image to text ratio: ${imageToTextRatio.toFixed(2)}`);

      if (imageToTextRatio < this.imageToTextRatioThreshold) {
        this.logger.log('Image to text ratio too low for gallery');
        return detection;
      }

      detection.isGallery = true;
      detection.confidence = Math.min(imageToTextRatio * 2, 1.0);

      detection.gridLayout = this.detectGridLayout();

      if (detection.gridLayout) {
        detection.galleryType = 'grid';
        detection.confidence = Math.min(detection.confidence + 0.2, 1.0);
      } else if (this.detectMasonryLayout()) {
        detection.galleryType = 'masonry';
        detection.confidence = Math.min(detection.confidence + 0.15, 1.0);
      } else if (this.detectCarousel()) {
        detection.galleryType = 'carousel';
        detection.confidence = Math.min(detection.confidence + 0.1, 1.0);
      } else if (this.detectTableLayout()) {
        detection.galleryType = 'table';
        detection.confidence = Math.min(detection.confidence + 0.1, 1.0);
      }

      const urlPatterns = ['/gallery/', '/photos/', '/images/', '/album/', '/portfolio/', '/pics/'];
      if (urlPatterns.some(pattern => window.location.href.toLowerCase().includes(pattern))) {
        detection.confidence = Math.min(detection.confidence + 0.1, 1.0);
      }

      detection.paginationMethods = this.detectPaginationIndicators();

      this.logger.log('Gallery detection complete:', detection);

      this.notifyGalleryDetected(detection);

      return detection;
    }

    findImages() {
      const images = [];

      const imgElements = document.querySelectorAll('img');
      imgElements.forEach(img => {
        if (this.isValidGalleryImage(img)) {
          images.push(img);
        }
      });

      const lazyImages = document.querySelectorAll('[data-src], [data-lazy], [data-original]');
      lazyImages.forEach(el => {
        if (!images.includes(el) && el.tagName === 'IMG') {
          images.push(el);
        }
      });

      const bgImages = this.findBackgroundImages();
      images.push(...bgImages);

      return images;
    }

    isValidGalleryImage(img) {
      const src = img.src || img.dataset.src || img.dataset.lazy || img.dataset.original;

      if (!src || src.length < 10) return false;

      if (src.includes('icon') || src.includes('logo') || src.includes('avatar') || 
          src.includes('button') || src.includes('badge') || src.includes('spinner')) {
        return false;
      }

      if (img.naturalWidth && img.naturalHeight) {
        if (img.naturalWidth < 100 || img.naturalHeight < 100) {
          return false;
        }
      }

      return true;
    }

    findBackgroundImages() {
      const bgImages = [];
      const allElements = document.querySelectorAll('*');

      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;

        if (bgImage && bgImage !== 'none' && bgImage.includes('url')) {
          const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (urlMatch && urlMatch[1]) {
            const url = urlMatch[1];
            if (url.length > 10 && !url.includes('data:image')) {
              bgImages.push({ element: el, url: url });
            }
          }
        }
      });

      return bgImages;
    }

    calculateImageToTextRatio(images) {
      const imageArea = images.reduce((total, img) => {
        if (img.element) {
          const rect = img.element.getBoundingClientRect();
          return total + (rect.width * rect.height);
        }
        const rect = img.getBoundingClientRect();
        return total + (rect.width * rect.height);
      }, 0);

      const textNodes = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td');
      const textArea = Array.from(textNodes).reduce((total, node) => {
        const rect = node.getBoundingClientRect();
        return total + (rect.width * rect.height);
      }, 0);

      if (textArea === 0) return 1.0;

      return imageArea / (imageArea + textArea);
    }

    detectGridLayout() {
      const containers = document.querySelectorAll('div, section, article, main');

      for (const container of containers) {
        const style = window.getComputedStyle(container);

        if (style.display === 'grid' || style.display === 'inline-grid') {
          const images = container.querySelectorAll('img');
          if (images.length >= 6) {
            return true;
          }
        }

        if (style.display === 'flex' || style.display === 'inline-flex') {
          const flexWrap = style.flexWrap;
          if (flexWrap === 'wrap') {
            const images = container.querySelectorAll('img');
            if (images.length >= 6) {
              return true;
            }
          }
        }
      }

      return false;
    }

    detectMasonryLayout() {
      const containers = document.querySelectorAll('[class*="masonry"], [class*="pinterest"], [class*="waterfall"]');
      return containers.length > 0;
    }

    detectCarousel() {
      const carouselSelectors = [
        '[class*="carousel"]',
        '[class*="slider"]',
        '[class*="slideshow"]',
        '[id*="carousel"]',
        '[id*="slider"]'
      ];

      for (const selector of carouselSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const images = element.querySelectorAll('img');
          if (images.length >= 3) {
            return true;
          }
        }
      }

      return false;
    }

    detectTableLayout() {
      const tables = document.querySelectorAll('table');

      for (const table of tables) {
        const images = table.querySelectorAll('img');
        if (images.length >= 6) {
          return true;
        }
      }

      return false;
    }

    detectPaginationIndicators() {
      const methods = [];

      if (document.querySelector('a[rel="next"], .next, .pagination, .pager')) {
        methods.push('nextButton');
      }

      if (document.querySelector('[class*="load-more"], [class*="show-more"]')) {
        methods.push('loadMore');
      }

      if (document.body.scrollHeight > window.innerHeight * 2) {
        methods.push('infiniteScroll');
      }

      const url = window.location.href;
      if (/[?&](page|p|pg|offset)=\d+/.test(url) || /\/page\/\d+/.test(url)) {
        methods.push('urlPattern');
      }

      return methods;
    }

    notifyGalleryDetected(detection) {
      try {
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.CORE_GALLERY_DETECTED,
          data: detection
        }).catch(err => this.logger.debug('Error sending gallery detection:', err));
      } catch (error) {
        this.logger.debug('Error notifying gallery detected:', error);
      }
    }
  }



  // ===== src/content/pagination-engine.js =====
  class PaginationEngine {
    constructor(options = {}) {
      this.logger = new Logger('PaginationEngine');
      this.method = options.method || 'auto';
      this.maxPages = options.maxPages || PAGINATION_CONFIG.MAX_PAGES;
      this.currentPage = 1;
      this.isActive = false;
      this.attempts = 0;
      this.contentHasher = new ContentHasher({ lookbackSize: PAGINATION_CONFIG.DUPLICATE_CHECK_LOOKBACK });
      this.latestPaginationInfo = null;
      this.settings = {
        paginationDelay: 2,
        scrollDelay: 500
      };
    }

    updateSettings(settings) {
      if (settings) {
        this.settings = {
          ...this.settings,
          paginationDelay: settings.paginationDelay ?? this.settings.paginationDelay,
          scrollDelay: settings.scrollDelay ?? this.settings.scrollDelay
        };
      }
    }

    async start(method = 'auto') {
      if (this.isActive) {
        this.logger.warn('Pagination already active');
        return;
      }

      this.method = method;
      this.isActive = true;
      this.attempts = 0;
      this.currentPage = 1;
      this.contentHasher.clear();

      this.logger.log(`Starting pagination with method: ${this.method}`);

      try {
        while (this.isActive && this.attempts < PAGINATION_CONFIG.MAX_ATTEMPTS && this.currentPage < this.maxPages) {
          const beforeHash = await this.contentHasher.hashContent(document.body);

          this.logger.log(`Page ${this.currentPage}, attempt ${this.attempts + 1}`);

          const success = await this.executeMethod();

          if (!success) {
            this.logger.log('Pagination method returned false, stopping');
            break;
          }

          this.attempts++;

          await this.waitForContent(PAGINATION_CONFIG.WAIT_FOR_CONTENT);

          const afterHash = await this.contentHasher.hashContent(document.body);

          if (this.contentHasher.isDuplicate(afterHash)) {
            this.logger.log('Duplicate content detected, stopping pagination');
            break;
          }

          this.contentHasher.addHash(afterHash);
          this.currentPage++;

          this.sendStatus('paginating');

          const paginationDelay = (this.settings.paginationDelay ?? 2) * 1000;
          await this.waitForContent(paginationDelay);
        }
      } catch (error) {
        this.logger.error('Pagination error:', error);
      }

      this.stop();
    }

    async executeMethod() {
      if (this.method === 'auto') {
        return await this.autoDetectAndExecute();
      }

      const methods = {
        'nextButton': () => this.paginateNextButton(),
        'loadMore': () => this.paginateLoadMore(),
        'infiniteScroll': () => this.paginateInfiniteScroll(),
        'arrow': () => this.paginateArrow(),
        'urlPattern': () => this.paginateUrlPattern(),
        'api': () => this.paginateAPI()
      };

      const methodFunc = methods[this.method];
      if (methodFunc) {
        return await methodFunc.call(this);
      }

      this.logger.warn(`Unknown pagination method: ${this.method}`);
      return false;
    }

    async autoDetectAndExecute() {
      const methods = await this.detectPaginationMethods();

      if (methods.nextButton.available) {
        this.logger.log('Using Next Button method');
        return await this.paginateNextButton(methods.nextButton);
      } else if (methods.loadMore.available) {
        this.logger.log('Using Load More method');
        return await this.paginateLoadMore(methods.loadMore);
      } else if (methods.arrow.available) {
        this.logger.log('Using Arrow method');
        return await this.paginateArrow(methods.arrow);
      } else if (methods.urlPattern.available) {
        this.logger.log('Using URL Pattern method');
        return await this.paginateUrlPattern(methods.urlPattern);
      } else if (methods.api.available) {
        this.logger.log('Using API method');
        return await this.paginateAPI(methods.api);
      } else if (methods.infiniteScroll.available) {
        this.logger.log('Using Infinite Scroll method');
        return await this.paginateInfiniteScroll();
      }

      this.logger.warn('No pagination method detected');
      return false;
    }

    async detectPaginationMethods() {
      const methods = {
        nextButton: await this.detectNextButton(),
        loadMore: await this.detectLoadMore(),
        infiniteScroll: this.detectInfiniteScroll(),
        arrow: await this.detectArrow(),
        urlPattern: this.detectUrlPattern(),
        api: { available: false }
      };

      return methods;
    }

    async detectNextButton() {
      const nextSelectors = [
        'a[rel="next"]',
        'link[rel="next"]',
        'a.next',
        'a.pagination-next',
        'a.page-next',
        'button.next',
        'a[aria-label*="next" i]',
        'a[title*="next" i]',
        '.pagination .next a',
        '.pager .next',
        'nav a[rel="next"]'
      ];

      for (const selector of nextSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element && this.isElementVisible(element) && !element.disabled && !element.classList.contains('disabled')) {
            return {
              available: true,
              selector: selector,
              element: element
            };
          }
        } catch (e) {
          this.logger.debug(`Error checking selector ${selector}:`, e);
        }
      }

      const allLinks = document.querySelectorAll('a, button');
      const nextPatterns = [
        /^next$/i,
        /^next\s+page$/i,
        /^→$/,
        /^›$/,
        /^»$/,
        /^continue$/i,
        /^siguiente$/i,
        /^suivant$/i,
        /^weiter$/i
      ];

      for (const link of allLinks) {
        const text = link.textContent.trim();
        if (nextPatterns.some(pattern => pattern.test(text)) && this.isElementVisible(link)) {
          return {
            available: true,
            selector: null,
            element: link
          };
        }
      }

      return { available: false };
    }

    async detectLoadMore() {
      const loadMoreSelectors = [
        'button[class*="load-more" i]',
        'a[class*="load-more" i]',
        'button[data-action="load-more"]',
        '[class*="show-more" i]',
        '[class*="view-more" i]',
        'button[aria-label*="load more" i]',
        '.infinite-scroll-button',
        '.load-more-btn'
      ];

      for (const selector of loadMoreSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element && this.isElementVisible(element)) {
            return {
              available: true,
              selector: selector,
              element: element
            };
          }
        } catch (e) {
          this.logger.debug(`Error checking selector ${selector}:`, e);
        }
      }

      const allButtons = document.querySelectorAll('button, a');
      const loadMorePatterns = [
        /load\s+more/i,
        /show\s+more/i,
        /view\s+more/i,
        /see\s+more/i,
        /mehr\s+laden/i,
        /voir\s+plus/i
      ];

      for (const button of allButtons) {
        const text = button.textContent.trim();
        if (loadMorePatterns.some(pattern => pattern.test(text)) && this.isElementVisible(button)) {
          return {
            available: true,
            selector: null,
            element: button
          };
        }
      }

      return { available: false };
    }

    async detectArrow() {
      const arrowSelectors = [
        'a[aria-label*="next" i]',
        'button[aria-label*="next" i]',
        '[class*="arrow-right"]',
        '[class*="chevron-right"]',
        '.icon-next',
        '.fa-arrow-right',
        '.fa-chevron-right'
      ];

      for (const selector of arrowSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element && this.isElementVisible(element)) {
            return {
              available: true,
              selector: selector,
              element: element
            };
          }
        } catch (e) {
          this.logger.debug(`Error checking selector ${selector}:`, e);
        }
      }

      return { available: false };
    }

    detectUrlPattern() {
      const queryPatterns = ['page', 'p', 'pg', 'pagenum', 'offset', 'start'];
      const pathPatterns = [
        /\/page\/(\d+)/,
        /\/p\/(\d+)/,
        /-page-(\d+)/,
        /-p(\d+)\./,
        /\/(\d+)$/
      ];

      try {
        const url = new URL(window.location.href);

        for (const param of queryPatterns) {
          if (url.searchParams.has(param)) {
            const currentPage = parseInt(url.searchParams.get(param)) || 1;
            return {
              available: true,
              type: 'query',
              param: param,
              currentPage: currentPage,
              nextPage: currentPage + 1
            };
          }
        }

        for (const pattern of pathPatterns) {
          const match = url.pathname.match(pattern);
          if (match) {
            const currentPage = parseInt(match[1]) || 1;
            return {
              available: true,
              type: 'path',
              pattern: pattern,
              currentPage: currentPage,
              nextPage: currentPage + 1
            };
          }
        }
      } catch (error) {
        this.logger.error('Error detecting URL pattern:', error);
      }

      return { available: false };
    }

    detectInfiniteScroll() {
      const scrollableContainers = document.querySelectorAll('[style*="overflow"]');

      for (const container of scrollableContainers) {
        const style = window.getComputedStyle(container);
        const overflowY = style.overflowY;

        if ((overflowY === 'scroll' || overflowY === 'auto') && 
            container.scrollHeight > container.clientHeight) {
          return {
            available: true,
            container: container
          };
        }
      }

      if (document.body.scrollHeight > window.innerHeight + 100) {
        return {
          available: true,
          container: document.body
        };
      }

      return { available: false };
    }

    async paginateNextButton(method = null) {
      const detectedMethod = method || await this.detectNextButton();

      if (!detectedMethod.available) {
        return false;
      }

      const element = detectedMethod.element || document.querySelector(detectedMethod.selector);

      if (!element || !this.isElementVisible(element)) {
        return false;
      }

      try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.waitForContent(500);

        element.click();
        this.logger.log('Clicked next button');
        return true;
      } catch (error) {
        this.logger.error('Error clicking next button:', error);
        return false;
      }
    }

    async paginateLoadMore(method = null) {
      const detectedMethod = method || await this.detectLoadMore();

      if (!detectedMethod.available) {
        return false;
      }

      const element = detectedMethod.element || document.querySelector(detectedMethod.selector);

      if (!element || !this.isElementVisible(element)) {
        return false;
      }

      try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.waitForContent(500);

        element.click();
        this.logger.log('Clicked load more button');
        return true;
      } catch (error) {
        this.logger.error('Error clicking load more button:', error);
        return false;
      }
    }

    async paginateInfiniteScroll() {
      try {
        const scrollTarget = document.documentElement || document.body;
        const currentScroll = window.scrollY;
        const targetScroll = scrollTarget.scrollHeight - window.innerHeight;

        if (currentScroll >= targetScroll - 100) {
          this.logger.log('Already at bottom of page');
          return false;
        }

        window.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });

        this.logger.log('Scrolled to bottom for infinite scroll');
        await this.waitForContent(1000);
        return true;
      } catch (error) {
        this.logger.error('Error performing infinite scroll:', error);
        return false;
      }
    }

    async paginateArrow(method = null) {
      const detectedMethod = method || await this.detectArrow();

      if (!detectedMethod.available) {
        return false;
      }

      const element = detectedMethod.element || document.querySelector(detectedMethod.selector);

      if (!element || !this.isElementVisible(element)) {
        return false;
      }

      try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.waitForContent(500);

        element.click();
        this.logger.log('Clicked arrow navigation');
        return true;
      } catch (error) {
        this.logger.error('Error clicking arrow:', error);
        return false;
      }
    }

    async paginateUrlPattern(method = null) {
      const detectedMethod = method || this.detectUrlPattern();

      if (!detectedMethod.available) {
        return false;
      }

      try {
        const currentUrl = new URL(window.location.href);
        let nextUrl;

        if (detectedMethod.type === 'query') {
          nextUrl = new URL(currentUrl);
          nextUrl.searchParams.set(detectedMethod.param, detectedMethod.nextPage.toString());
        } else if (detectedMethod.type === 'path') {
          nextUrl = new URL(currentUrl);
          nextUrl.pathname = currentUrl.pathname.replace(
            detectedMethod.pattern,
            (match, pageNum) => match.replace(pageNum, detectedMethod.nextPage.toString())
          );
        }

        if (nextUrl && nextUrl.href !== currentUrl.href) {
          this.logger.log(`Navigating to: ${nextUrl.href}`);
          window.location.href = nextUrl.href;
          return true;
        }
      } catch (error) {
        this.logger.error('Error navigating to next page via URL pattern:', error);
      }

      return false;
    }

    async paginateAPI(method = null) {
      this.logger.log('API pagination requires network monitoring integration');
      return false;
    }

    isElementVisible(element) {
      if (!element) return false;

      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    waitForContent(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    stop() {
      this.isActive = false;
      this.sendStatus('complete');
      this.logger.log(`Pagination complete. Pages processed: ${this.currentPage}, Attempts: ${this.attempts}`);
    }

    sendStatus(status) {
      try {
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.CORE_PAGINATION_STATUS,
          data: {
            status: status,
            currentPage: this.currentPage,
            attempts: this.attempts,
            method: this.method,
            message: status === 'complete' ? 
              (this.attempts >= PAGINATION_CONFIG.MAX_ATTEMPTS ? 'Max attempts reached' : 'Pagination complete') :
              'Paginating...'
          }
        }).catch(err => this.logger.debug('Error sending status:', err));
      } catch (error) {
        this.logger.debug('Error sending pagination status:', error);
      }
    }
  }



  // ===== src/content/content-main.js =====
  const contentLogger = new Logger('Content');

  let galleryDetector = null;
  let imageExtractor = null;
  let paginationEngine = null;
  let networkMonitor = null;

  function initialize() {
    contentLogger.log('Initializing StepGallery content script');

    galleryDetector = new GalleryDetector();
    imageExtractor = new ImageExtractor();
    paginationEngine = new PaginationEngine();
    networkMonitor = new NetworkMonitor();

    networkMonitor.inject();

    setTimeout(() => {
      galleryDetector.detectGallery();
    }, 1000);

    try {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CORE_INIT
      }).catch(err => contentLogger.debug('Error sending init message:', err));
    } catch (error) {
      contentLogger.debug('Error sending init:', error);
    }

    setupMessageListeners();

    if (FEATURES.DEBUG_PANEL) {
      loadDebugPanel();
    }

    contentLogger.log('StepGallery content script initialized');
  }

  function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      contentLogger.debug('Received message:', message.type);

      try {
        if (message.type === MESSAGE_TYPES.CORE_PAGINATION_START) {
          handlePaginationStart(message, sendResponse);
          return true;
        }

        if (message.type === MESSAGE_TYPES.CORE_PAGINATION_STOP) {
          handlePaginationStop(message, sendResponse);
          return true;
        }

        if (message.type === 'detect-gallery') {
          handleDetectGallery(message, sendResponse);
          return true;
        }

        if (message.type === 'extract-images') {
          handleExtractImages(message, sendResponse);
          return true;
        }

        if (message.type === 'get-pagination-info') {
          handleGetPaginationInfo(message, sendResponse);
          return true;
        }

        if (message.type === 'clear-data') {
          handleClearData(message, sendResponse);
          return true;
        }
      } catch (error) {
        contentLogger.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      }

      return false;
    });
  }

  async function handlePaginationStart(message, sendResponse) {
    try {
      const method = message.method || message.data?.method || 'auto';
      contentLogger.log(`Starting pagination with method: ${method}`);

      const stored = await chrome.storage.local.get('settings');
      if (stored.settings) {
        paginationEngine.updateSettings(stored.settings);
      }

      imageExtractor.reset();

      // Use the new lazy loading approach for initial extraction
      await imageExtractor.extractImagesWithLazyLoading({
        scrollDelay: stored.settings?.scrollDelay || 500,
        maxScrollSteps: 20
      });

      setTimeout(async () => {
        await paginationEngine.start(method);
      }, 500);

      const intervalId = setInterval(async () => {
        if (paginationEngine.isActive) {
          // Use lazy loading extraction during pagination as well
          await imageExtractor.extractImagesWithLazyLoading({
            scrollDelay: stored.settings?.scrollDelay || 500,
            maxScrollSteps: 10 // Fewer steps during pagination to be faster
          });
          imageExtractor.incrementPage();
        } else {
          clearInterval(intervalId);
        }
      }, 3000);

      sendResponse({ success: true });
    } catch (error) {
      contentLogger.error('Error starting pagination:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  function handlePaginationStop(message, sendResponse) {
    try {
      contentLogger.log('Stopping pagination');
      paginationEngine.stop();
      sendResponse({ success: true });
    } catch (error) {
      contentLogger.error('Error stopping pagination:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async function handleDetectGallery(message, sendResponse) {
    try {
      const detection = await galleryDetector.detectGallery();
      sendResponse({ success: true, detection: detection });
    } catch (error) {
      contentLogger.error('Error detecting gallery:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async function handleExtractImages(message, sendResponse) {
    try {
      // Support both normal extraction and lazy loading extraction
      const useLazyLoading = message.useLazyLoading !== false; // Default to true

      let images;
      if (useLazyLoading) {
        const stored = await chrome.storage.local.get('settings');
        images = await imageExtractor.extractImagesWithLazyLoading({
          scrollDelay: stored.settings?.scrollDelay || 500,
          maxScrollSteps: 20
        });
      } else {
        images = await imageExtractor.extractImages();
      }

      sendResponse({ success: true, images: images });
    } catch (error) {
      contentLogger.error('Error extracting images:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  function handleGetPaginationInfo(message, sendResponse) {
    try {
      const paginationInfo = networkMonitor.getLatestPaginationInfo();
      sendResponse({ success: true, paginationInfo: paginationInfo });
    } catch (error) {
      contentLogger.error('Error getting pagination info:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  function handleClearData(message, sendResponse) {
    try {
      imageExtractor.reset();
      networkMonitor.clear();
      paginationEngine.contentHasher.clear();
      sendResponse({ success: true });
    } catch (error) {
      contentLogger.error('Error clearing data:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  function loadDebugPanel() {
    contentLogger.log('Loading debug panel (dev mode)');

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }


})();
