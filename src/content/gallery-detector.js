import { Logger } from '../shared/logger.js';
import { MESSAGE_TYPES } from '../shared/constants.js';

export class GalleryDetector {
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

export default GalleryDetector;
