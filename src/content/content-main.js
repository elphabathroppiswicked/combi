import { Logger } from '../shared/logger.js';
import { FEATURES, MESSAGE_TYPES } from '../shared/constants.js';
import { GalleryDetector } from './gallery-detector.js';
import { ImageExtractor } from './image-extractor.js';
import { PaginationEngine } from './pagination-engine.js';
import { NetworkMonitor } from './network-monitor.js';

const logger = new Logger('Content');

let galleryDetector = null;
let imageExtractor = null;
let paginationEngine = null;
let networkMonitor = null;

function initialize() {
  logger.log('Initializing StepGallery content script');

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
    }).catch(err => logger.debug('Error sending init message:', err));
  } catch (error) {
    logger.debug('Error sending init:', error);
  }

  setupMessageListeners();
  
  if (FEATURES.DEBUG_PANEL) {
    loadDebugPanel();
  }

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

      if (message.type === 'get-pagination-info') {
        handleGetPaginationInfo(message, sendResponse);
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
    logger.error('Error extracting images:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function handleGetPaginationInfo(message, sendResponse) {
  try {
    const paginationInfo = networkMonitor.getLatestPaginationInfo();
    sendResponse({ success: true, paginationInfo: paginationInfo });
  } catch (error) {
    logger.error('Error getting pagination info:', error);
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
    logger.error('Error clearing data:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function loadDebugPanel() {
  logger.log('Loading debug panel (dev mode)');
  
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
