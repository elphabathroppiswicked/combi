export const VERSION = '3.0.0';

export const DEV_MODE = (() => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const url = chrome.runtime.getURL('');
      return url.includes('localhost') || url.includes('dev');
    }
  } catch (e) {}
  return false;
})();

export const FEATURES = {
  DEBUG_PANEL: DEV_MODE,
  VERBOSE_LOGGING: DEV_MODE,
  PERFORMANCE_PROFILING: DEV_MODE
};

export const PAGINATION_CONFIG = {
  MAX_PAGES: 50,
  MAX_ATTEMPTS: 50,
  WAIT_AFTER_CLICK: 2000,
  WAIT_FOR_CONTENT: 1500,
  SCROLL_DELAY: 500,
  DUPLICATE_CHECK_LOOKBACK: 10
};

export const EXPORT_CONFIG = {
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
  BATCH_SIZE: 100,
  COMPRESSION_LEVEL: 6,
  STREAMING_THRESHOLD: 500,
  LARGE_DATASET_THRESHOLD: 1000
};

export const DOWNLOAD_CONFIG = {
  CONCURRENT_DOWNLOADS: 3,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

export const MESSAGE_TYPES = {
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

export const DEFAULT_SETTINGS = {
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
