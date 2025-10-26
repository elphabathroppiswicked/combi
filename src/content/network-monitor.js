import { Logger } from '../shared/this.logger.js';
import { MESSAGE_TYPES } from '../shared/constants.js';

export class NetworkMonitor {
  constructor(options = {}) {
    this.logger = new Logger('NetworkMonitor');
    this.capturedResponses = [];
    this.latestPaginationInfo = null;
    this.detectedEndpoints = [];
    this.isInjected = false;
  }

  inject() {
    if (this.isInjected) {
      this.this.logger.debug('Network monitor already injected');
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

export default NetworkMonitor;
