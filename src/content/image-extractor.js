import { Logger } from '../shared/logger.js';
import { InputSanitizer } from '../shared/input-sanitizer.js';
import { MESSAGE_TYPES } from '../shared/constants.js';

const logger = new Logger('ImageExtractor');

export class ImageExtractor {
  constructor(options = {}) {
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
      logger.error('Error extracting from lazy element:', error);
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
        logger.debug('Error extracting background image:', error);
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
        logger.debug('Error extracting from link:', error);
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
    
    logger.log('Starting lazy loading trigger with IntersectionObserver');
    
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
    
    logger.log(`Lazy loading triggered, ${this.lazyLoadedImages.size} images loaded`);
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
    
    logger.debug('IntersectionObserver initialized for lazy loading');
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
            logger.debug(`Lazy-loaded image src populated: ${newSrc.substring(0, 50)}...`);
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
    
    logger.debug(`Completed ${steps} scroll steps to trigger lazy loading`);
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
      }).catch(err => logger.debug('Error sending images found:', err));
    } catch (error) {
      logger.debug('Error notifying images found:', error);
    }
  }
}

export default ImageExtractor;
