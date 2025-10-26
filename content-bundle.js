(function() {
  'use strict';

  const VERSION = '3.0.0';
  const DEV_MODE = false;

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
    
    SETTINGS_UPDATE: 'settings/update',
    SETTINGS_GET: 'settings/get',
    
    GET_IMAGES: 'get/images',
    CLEAR_IMAGES: 'clear/images',
    
    API_ENDPOINT_DETECTED: 'api/endpoint-detected',
    API_RESPONSE_CAPTURED: 'api/response-captured'
  };

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

  class ContentHasher {
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
    }
  }

  class InputSanitizer {
    constructor(options = {}) {
      this.options = {
        maxSelectorLength: options.maxSelectorLength || 10000,
        maxUrlLength: options.maxUrlLength || 2048,
        maxFilenameLength: options.maxFilenameLength || 255,
        allowedProtocols: options.allowedProtocols || ['http:', 'https:'],
        ...options
      };
    }

    sanitizeUrl(url, options = {}) {
      if (!url || typeof url !== 'string') {
        return '';
      }

      url = url.trim();

      if (url.length === 0 || url.length > this.options.maxUrlLength) {
        return '';
      }

      if (/javascript:|data:text\/html|vbscript:|file:|<script/i.test(url)) {
        return '';
      }

      try {
        const urlObj = new URL(url);
        
        if (!this.options.allowedProtocols.includes(urlObj.protocol)) {
          return '';
        }

        return urlObj.href;
      } catch (e) {
        if (url.startsWith('/') || url.startsWith('./')) {
          return url;
        }
        
        return '';
      }
    }

    sanitizeFilename(filename) {
      if (!filename || typeof filename !== 'string') {
        return 'file';
      }

      filename = filename.trim();

      if (filename.length === 0) {
        return 'file';
      }

      if (/\.\.|\/\.\.|\.\.[\\/]|^[\\\/]/.test(filename)) {
        filename = filename.replace(/\.\.|\/\.\.|\.\.[\\/]|^[\\\/]/g, '');
      }

      filename = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

      if (filename.length > this.options.maxFilenameLength) {
        const ext = filename.split('.').pop();
        const base = filename.substring(0, this.options.maxFilenameLength - ext.length - 1);
        filename = `${base}.${ext}`;
      }

      return filename || 'file';
    }
  }

  const logger = new Logger('Content');
  const sanitizer = new InputSanitizer();

  class PaginationEngine {
    constructor(options = {}) {
      this.method = options.method || 'auto';
      this.maxPages = options.maxPages || PAGINATION_CONFIG.MAX_PAGES;
      this.currentPage = 1;
      this.isActive = false;
      this.attempts = 0;
      this.contentHasher = new ContentHasher({ lookbackSize: PAGINATION_CONFIG.DUPLICATE_CHECK_LOOKBACK });
    }

    async start(method = 'auto') {
      if (this.isActive) {
        logger.warn('Pagination already active');
        return;
      }

      this.method = method;
      this.isActive = true;
      this.attempts = 0;
      this.currentPage = 1;
      this.contentHasher.clear();

      logger.log(`Starting pagination with method: ${this.method}`);

      try {
        while (this.isActive && this.attempts < PAGINATION_CONFIG.MAX_ATTEMPTS && this.currentPage < this.maxPages) {
          const beforeHash = await this.contentHasher.hashContent(document.body);
          
          logger.log(`Page ${this.currentPage}, attempt ${this.attempts + 1}`);
          
          const success = await this.executeMethod();
          
          if (!success) {
            logger.log('Pagination method returned false, stopping');
            break;
          }

          this.attempts++;
          
          await this.waitForContent(PAGINATION_CONFIG.WAIT_FOR_CONTENT);
          
          const afterHash = await this.contentHasher.hashContent(document.body);
          
          if (this.contentHasher.isDuplicate(afterHash)) {
            logger.log('Duplicate content detected, stopping pagination');
            break;
          }
          
          this.contentHasher.addHash(afterHash);
          this.currentPage++;
          
          this.sendStatus('paginating');
          
          await this.waitForContent(PAGINATION_CONFIG.WAIT_AFTER_CLICK);
        }
      } catch (error) {
        logger.error('Pagination error:', error);
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
        'urlPattern': () => this.paginateUrlPattern()
      };

      const methodFunc = methods[this.method];
      if (methodFunc) {
        return await methodFunc.call(this);
      }

      logger.warn(`Unknown pagination method: ${this.method}`);
      return false;
    }

    async autoDetectAndExecute() {
      const nextBtn = await this.detectNextButton();
      if (nextBtn.available) {
        logger.log('Using Next Button method');
        return await this.paginateNextButton(nextBtn);
      }

      const loadMore = await this.detectLoadMore();
      if (loadMore.available) {
        logger.log('Using Load More method');
        return await this.paginateLoadMore(loadMore);
      }

      const arrow = await this.detectArrow();
      if (arrow.available) {
        logger.log('Using Arrow method');
        return await this.paginateArrow(arrow);
      }

      const urlPattern = this.detectUrlPattern();
      if (urlPattern.available) {
        logger.log('Using URL Pattern method');
        return await this.paginateUrlPattern(urlPattern);
      }

      const infiniteScroll = this.detectInfiniteScroll();
      if (infiniteScroll.available) {
        logger.log('Using Infinite Scroll method');
        return await this.paginateInfiniteScroll();
      }

      logger.warn('No pagination method detected');
      return false;
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
        } catch (e) {}
      }

      const allLinks = document.querySelectorAll('a, button');
      const nextPatterns = [
        /^next$/i,
        /^next\s+page$/i,
        /^→$/,
        /^›$/,
        /^»$/
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
        } catch (e) {}
      }

      const allButtons = document.querySelectorAll('button, a');
      const loadMorePatterns = [
        /load\s+more/i,
        /show\s+more/i,
        /view\s+more/i,
        /see\s+more/i
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
        } catch (e) {}
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
        logger.error('Error detecting URL pattern:', error);
      }

      return { available: false };
    }

    detectInfiniteScroll() {
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
        logger.log('Clicked next button');
        return true;
      } catch (error) {
        logger.error('Error clicking next button:', error);
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
        logger.log('Clicked load more button');
        return true;
      } catch (error) {
        logger.error('Error clicking load more button:', error);
        return false;
      }
    }

    async paginateInfiniteScroll() {
      try {
        const scrollTarget = document.documentElement || document.body;
        const currentScroll = window.scrollY;
        const targetScroll = scrollTarget.scrollHeight - window.innerHeight;

        if (currentScroll >= targetScroll - 100) {
          logger.log('Already at bottom of page');
          return false;
        }

        window.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });

        logger.log('Scrolled to bottom for infinite scroll');
        await this.waitForContent(1000);
        return true;
      } catch (error) {
        logger.error('Error performing infinite scroll:', error);
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
        logger.log('Clicked arrow navigation');
        return true;
      } catch (error) {
        logger.error('Error clicking arrow:', error);
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
          logger.log(`Navigating to: ${nextUrl.href}`);
          window.location.href = nextUrl.href;
          return true;
        }
      } catch (error) {
        logger.error('Error navigating to next page via URL pattern:', error);
      }

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
      logger.log(`Pagination complete. Pages processed: ${this.currentPage}, Attempts: ${this.attempts}`);
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
        }).catch(err => logger.debug('Error sending status:', err));
      } catch (error) {
        logger.debug('Error sending pagination status:', error);
      }
    }
  }

  class GalleryDetector {
    constructor(options = {}) {
      this.minImagesForGallery = options.minImagesForGallery || 10;
      this.imageToTextRatioThreshold = options.imageToTextRatioThreshold || 0.3;
    }

    async detectGallery() {
      logger.log('Starting gallery detection');

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
        logger.log(`Not enough images (${images.length}) for gallery detection`);
        return detection;
      }

      const imageToTextRatio = this.calculateImageToTextRatio(images);
      logger.log(`Image to text ratio: ${imageToTextRatio.toFixed(2)}`);

      if (imageToTextRatio < this.imageToTextRatioThreshold) {
        logger.log('Image to text ratio too low for gallery');
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

      logger.log('Gallery detection complete:', detection);
      
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

    calculateImageToTextRatio(images) {
      const imageArea = images.reduce((total, img) => {
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
        }).catch(err => logger.debug('Error sending gallery detection:', err));
      } catch (error) {
        logger.debug('Error notifying gallery detected:', error);
      }
    }
  }

  class ImageExtractor {
    constructor(options = {}) {
      this.minWidth = options.minWidth || 100;
      this.minHeight = options.minHeight || 100;
      this.extractedUrls = new Set();
      this.pageNumber = 1;
    }

    extractImages() {
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

      logger.log(`Extracted ${images.length} images from page ${this.pageNumber}`);
      
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

        const sanitizedUrl = sanitizer.sanitizeUrl(src);
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
          filename: sanitizer.sanitizeFilename(filename),
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
        logger.error('Error extracting from img tag:', error);
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

        const sanitizedUrl = sanitizer.sanitizeUrl(imageUrl);
        if (!sanitizedUrl) return null;

        const fullUrl = sanitizedUrl.startsWith('http') ? sanitizedUrl : new URL(sanitizedUrl, window.location.href).href;
        
        const filename = this.extractFilename(fullUrl);
        const caption = el.alt || el.title || el.getAttribute('aria-label') || '';

        return {
          filename: sanitizer.sanitizeFilename(filename),
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
        logger.error('Error extracting from lazy element:', error);
        return null;
      }
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
    }

    notifyImagesFound(images) {
      try {
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.CORE_IMAGES_FOUND,
          images: images
        }).catch(err => logger.debug('Error sending images found:', err));
      } catch (error) {
        logger.debug('Error notifying images found:', error);
      }
    }
  }

  let galleryDetector = null;
  let imageExtractor = null;
  let paginationEngine = null;

  function initialize() {
    logger.log('Initializing StepGallery content script');

    galleryDetector = new GalleryDetector();
    imageExtractor = new ImageExtractor();
    paginationEngine = new PaginationEngine();

    setTimeout(() => {
      galleryDetector.detectGallery();
    }, 1000);

    try {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CORE_INIT
      }).catch(err => logger.debug('Error sending init message:', err));
    } catch (error) {
      logger.debug('Error sending init:', error);
    }

    setupMessageListeners();

    logger.log('StepGallery content script initialized');
  }

  function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      logger.debug('Received message:', message.type);

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

        if (message.type === 'clear-data') {
          handleClearData(message, sendResponse);
          return true;
        }
      } catch (error) {
        logger.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      }

      return false;
    });
  }

  async function handlePaginationStart(message, sendResponse) {
    try {
      const method = message.method || message.data?.method || 'auto';
      logger.log(`Starting pagination with method: ${method}`);

      imageExtractor.reset();
      
      imageExtractor.extractImages();

      setTimeout(async () => {
        await paginationEngine.start(method);
      }, 500);

      const intervalId = setInterval(() => {
        if (paginationEngine.isActive) {
          imageExtractor.extractImages();
          imageExtractor.incrementPage();
        } else {
          clearInterval(intervalId);
        }
      }, 3000);

      sendResponse({ success: true });
    } catch (error) {
      logger.error('Error starting pagination:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  function handlePaginationStop(message, sendResponse) {
    try {
      logger.log('Stopping pagination');
      paginationEngine.stop();
      sendResponse({ success: true });
    } catch (error) {
      logger.error('Error stopping pagination:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async function handleDetectGallery(message, sendResponse) {
    try {
      const detection = await galleryDetector.detectGallery();
      sendResponse({ success: true, detection: detection });
    } catch (error) {
      logger.error('Error detecting gallery:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  function handleExtractImages(message, sendResponse) {
    try {
      const images = imageExtractor.extractImages();
      sendResponse({ success: true, images: images });
    } catch (error) {
      logger.error('Error extracting images:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  function handleClearData(message, sendResponse) {
    try {
      imageExtractor.reset();
      sendResponse({ success: true });
    } catch (error) {
      logger.error('Error clearing data:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
