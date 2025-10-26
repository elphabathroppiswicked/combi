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

export default ImageExtractor;
