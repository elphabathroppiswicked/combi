import { Logger } from '../shared/this.logger.js';
import { ContentHasher } from '../shared/content-hasher.js';
import { PAGINATION_CONFIG, MESSAGE_TYPES } from '../shared/constants.js';

export class PaginationEngine {
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

export default PaginationEngine;
