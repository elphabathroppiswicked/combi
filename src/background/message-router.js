import { Logger } from '../shared/logger.js';
import { MESSAGE_TYPES } from '../shared/constants.js';

const logger = new Logger('MessageRouter');

export class MessageRouter {
  constructor(dependencies) {
    this.state = dependencies.state;
    this.downloads = dependencies.downloads;
    this.exports = dependencies.exports;
  }

  handle(message, sender, sendResponse) {
    logger.debug(`Handling message: ${message.type}`);

    try {
      if (message.type === MESSAGE_TYPES.CORE_INIT) {
        return this.handleInit(message, sender, sendResponse);
      }

      if (message.type === MESSAGE_TYPES.CORE_GALLERY_DETECTED) {
        return this.handleGalleryDetected(message, sender, sendResponse);
      }

      if (message.type === MESSAGE_TYPES.CORE_IMAGES_FOUND) {
        return this.handleImagesFound(message, sender, sendResponse);
      }

      if (message.type === MESSAGE_TYPES.CORE_PAGINATION_STATUS) {
        return this.handlePaginationStatus(message, sender, sendResponse);
      }

      if (message.type === MESSAGE_TYPES.GET_IMAGES) {
        return this.handleGetImages(message, sender, sendResponse);
      }

      if (message.type === MESSAGE_TYPES.CLEAR_IMAGES) {
        return this.handleClearImages(message, sender, sendResponse);
      }

      if (message.type === MESSAGE_TYPES.SETTINGS_UPDATE) {
        return this.handleSettingsUpdate(message, sender, sendResponse);
      }

      if (message.type === MESSAGE_TYPES.SETTINGS_GET) {
        return this.handleSettingsGet(message, sender, sendResponse);
      }

      if (message.type === MESSAGE_TYPES.DOWNLOAD_START) {
        return this.handleDownloadStart(message, sender, sendResponse);
      }

      if (message.type === 'download/batch-response') {
        return this.handleBatchResponse(message, sender, sendResponse);
      }

      if (message.type === 'download/file') {
        return this.handleFileDownload(message, sender, sendResponse);
      }

      if (message.type.startsWith('export/')) {
        return this.handleExport(message, sender, sendResponse);
      }

      if (message.type === MESSAGE_TYPES.API_ENDPOINT_DETECTED) {
        return this.handleApiEndpointDetected(message, sender, sendResponse);
      }

      if (message.type === 'get-status') {
        return this.handleGetStatus(message, sender, sendResponse);
      }

    } catch (error) {
      logger.error('Error in message router:', error);
      sendResponse({ success: false, error: error.message });
    }

    return false;
  }

  handleInit(message, sender, sendResponse) {
    if (sender.tab) {
      this.state.setCurrentTab(sender.tab.id);
      
      chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
    }
    
    sendResponse({ success: true });
    return false;
  }

  handleGalleryDetected(message, sender, sendResponse) {
    const { isGallery, imageCount } = message.data;
    
    this.state.updateGalleryStatus(message.data);

    if (isGallery && sender.tab) {
      chrome.action.setBadgeText({ 
        text: String(imageCount), 
        tabId: sender.tab.id 
      });
      chrome.action.setBadgeBackgroundColor({ 
        color: '#4CAF50', 
        tabId: sender.tab.id 
      });
    }

    this.broadcastToUI({
      type: 'gallery-status-update',
      data: message.data
    });

    sendResponse({ success: true });
    return false;
  }

  handleImagesFound(message, sender, sendResponse) {
    const result = this.state.addImages(message.images);

    this.broadcastToUI({
      type: 'images-update',
      images: this.state.getImages()
    });

    sendResponse({ success: true, total: result.total, added: result.added });
    return false;
  }

  handlePaginationStatus(message, sender, sendResponse) {
    this.state.updatePaginationStatus(message.data);

    this.broadcastToUI({
      type: 'pagination-status-update',
      data: message.data
    });

    sendResponse({ success: true });
    return false;
  }

  handleGetImages(message, sender, sendResponse) {
    const images = this.state.getImages();
    sendResponse({ success: true, images: images });
    return false;
  }

  handleClearImages(message, sender, sendResponse) {
    this.state.clearImages();

    this.broadcastToUI({
      type: 'images-update',
      images: []
    });

    sendResponse({ success: true });
    return false;
  }

  handleSettingsUpdate(message, sender, sendResponse) {
    this.state.updateSettings(message.settings).then(() => {
      sendResponse({ success: true, settings: this.state.getSettings() });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  handleSettingsGet(message, sender, sendResponse) {
    const settings = this.state.getSettings();
    sendResponse({ success: true, settings: settings });
    return false;
  }

  async handleDownloadStart(message, sender, sendResponse) {
    try {
      const images = message.images || this.state.getImages();
      const options = message.options || {};

      await this.downloads.downloadImages(images, options);

      sendResponse({ success: true });
    } catch (error) {
      logger.error('Error starting download:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  handleBatchResponse(message, sender, sendResponse) {
    try {
      this.downloads.resumeDownloads(message.continue);
      sendResponse({ success: true });
    } catch (error) {
      logger.error('Error handling batch response:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  async handleFileDownload(message, sender, sendResponse) {
    try {
      const { url, filename, saveAs } = message.data;
      
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: saveAs !== undefined ? saveAs : true
      });

      logger.log(`File download started: ${filename} (ID: ${downloadId})`);
      sendResponse({ success: true, downloadId: downloadId });
    } catch (error) {
      logger.error('Error starting file download:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  async handleExport(message, sender, sendResponse) {
    try {
      const format = message.type.split('/')[1];
      const images = message.data?.images || this.state.getImages();
      const options = message.data || {};

      const result = await this.exports.exportData(format, images, options);

      sendResponse({ success: true, result: result });
    } catch (error) {
      logger.error('Error exporting:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  handleApiEndpointDetected(message, sender, sendResponse) {
    logger.log('API endpoint detected:', message.endpoint);
    sendResponse({ success: true });
    return false;
  }

  handleGetStatus(message, sender, sendResponse) {
    const stats = this.state.getStats();
    const downloadStatus = this.downloads.getStatus();

    sendResponse({ 
      success: true, 
      stats: stats,
      downloads: downloadStatus
    });
    return false;
  }

  broadcastToUI(message) {
    try {
      chrome.runtime.sendMessage(message).catch(err => {
        logger.debug('Error broadcasting to UI:', err);
      });
    } catch (error) {
      logger.debug('Error broadcasting:', error);
    }
  }
}

export default MessageRouter;
