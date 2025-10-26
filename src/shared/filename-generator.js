import { Logger } from './logger.js';

const logger = new Logger('FilenameGenerator');

export class FilenameGenerator {
  constructor() {
    logger.log('FilenameGenerator initialized');
  }

  generate(image, pattern, index = 0) {
    if (!pattern || typeof pattern !== 'string') {
      logger.warn('Invalid pattern provided, using default');
      return `image-${index}.jpg`;
    }

    if (!image || typeof image !== 'object') {
      logger.warn('Invalid image object provided');
      return pattern;
    }

    let filename = pattern;

    const replacements = {
      '*name*': () => this.extractBaseName(image),
      '*ext*': () => this.extractExtension(image),
      '*fullname*': () => image.filename || 'image.jpg',
      
      '*num*': () => (index + 1).toString(),
      '*num-3*': () => (index + 1).toString().padStart(3, '0'),
      '*num-5*': () => (index + 1).toString().padStart(5, '0'),
      '*index*': () => index.toString(),
      
      '*y*': () => this.getCurrentYear(),
      '*m*': () => this.getCurrentMonth(),
      '*d*': () => this.getCurrentDay(),
      '*hh*': () => this.getCurrentHour(),
      '*mm*': () => this.getCurrentMinute(),
      '*ss*': () => this.getCurrentSecond(),
      '*date*': () => this.getFormattedDate(),
      '*time*': () => this.getFormattedTime(),
      '*datetime*': () => this.getFormattedDateTime(),
      '*timestamp*': () => Date.now().toString(),
      
      '*url*': () => image.fileUrl || '',
      '*domain*': () => this.extractDomain(image),
      '*hostname*': () => this.extractHostname(image),
      
      '*subdirs0*': () => this.getPathSegment(image, 0),
      '*subdirs1*': () => this.getPathSegment(image, 1),
      '*subdirs2*': () => this.getPathSegment(image, 2),
      '*subdirs3*': () => this.getPathSegment(image, 3),
      '*subdirsLast*': () => this.getLastPathSegment(image),
      
      '*page*': () => (image.pageNumber || 1).toString(),
      '*caption*': () => this.sanitizeCaption(image.caption || '')
    };

    Object.entries(replacements).forEach(([token, replacer]) => {
      try {
        const value = replacer();
        filename = filename.replace(new RegExp(token.replace(/\*/g, '\\*'), 'g'), value);
      } catch (error) {
        logger.error(`Error replacing token ${token}:`, error);
        filename = filename.replace(new RegExp(token.replace(/\*/g, '\\*'), 'g'), '');
      }
    });

    return filename;
  }

  extractBaseName(image) {
    try {
      const filename = image.filename || 'image';
      return filename.replace(/\.[^/.]+$/, '');
    } catch (error) {
      logger.error('Error extracting base name:', error);
      return 'image';
    }
  }

  extractExtension(image) {
    try {
      const filename = image.filename || '';
      const ext = filename.split('.').pop();
      return ext || 'jpg';
    } catch (error) {
      logger.error('Error extracting extension:', error);
      return 'jpg';
    }
  }

  extractDomain(image) {
    try {
      const url = image.fileUrl || image.sourcePage || '';
      if (!url) return 'unknown';
      
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/\./g, '-');
    } catch (error) {
      logger.debug('Error extracting domain:', error);
      return 'unknown';
    }
  }

  extractHostname(image) {
    try {
      const url = image.fileUrl || image.sourcePage || '';
      if (!url) return 'unknown';
      
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      logger.debug('Error extracting hostname:', error);
      return 'unknown';
    }
  }

  extractPathSegments(url) {
    try {
      if (!url || typeof url !== 'string') {
        return [];
      }

      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      const segments = pathname
        .split('/')
        .filter(segment => segment.length > 0);
      
      if (segments.length > 0) {
        segments.pop();
      }
      
      return segments;
    } catch (error) {
      logger.debug('Error extracting path segments:', error);
      return [];
    }
  }

  getPathSegment(image, index) {
    try {
      const url = image.fileUrl || '';
      const segments = this.extractPathSegments(url);
      return segments[index] || '';
    } catch (error) {
      logger.debug(`Error getting path segment ${index}:`, error);
      return '';
    }
  }

  getLastPathSegment(image) {
    try {
      const url = image.fileUrl || '';
      const segments = this.extractPathSegments(url);
      return segments.length > 0 ? segments[segments.length - 1] : '';
    } catch (error) {
      logger.debug('Error getting last path segment:', error);
      return '';
    }
  }

  getCurrentYear() {
    return new Date().getFullYear().toString();
  }

  getCurrentMonth() {
    return String(new Date().getMonth() + 1).padStart(2, '0');
  }

  getCurrentDay() {
    return String(new Date().getDate()).padStart(2, '0');
  }

  getCurrentHour() {
    return String(new Date().getHours()).padStart(2, '0');
  }

  getCurrentMinute() {
    return String(new Date().getMinutes()).padStart(2, '0');
  }

  getCurrentSecond() {
    return String(new Date().getSeconds()).padStart(2, '0');
  }

  getFormattedDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getFormattedTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}-${minutes}-${seconds}`;
  }

  getFormattedDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}`;
  }

  sanitizeCaption(caption) {
    try {
      if (!caption || typeof caption !== 'string') {
        return '';
      }
      
      return caption
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
    } catch (error) {
      logger.error('Error sanitizing caption:', error);
      return '';
    }
  }
}

export default FilenameGenerator;
