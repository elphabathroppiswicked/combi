import { Logger } from '../shared/logger.js';

const logger = new Logger('ExportController');

export class ExportController {
  constructor() {
    this.offscreenDocumentId = null;
    this.isOffscreenReady = false;
  }

  async exportData(format, images, options = {}) {
    logger.log(`Exporting ${images.length} images to ${format.toUpperCase()} format`);

    try {
      await this.ensureOffscreenDocument();

      const response = await this.sendToOffscreen({
        type: `export/${format}`,
        data: {
          images: images,
          fields: options.fields || this.getDefaultFields(),
          includeMetadata: options.includeMetadata || false,
          filename: options.filename || `stepgallery-export-${Date.now()}`
        }
      });

      logger.log(`Export ${format} complete:`, response);
      return response;

    } catch (error) {
      logger.error(`Export ${format} failed:`, error);
      throw error;
    }
  }

  async ensureOffscreenDocument() {
    if (this.isOffscreenReady) {
      return;
    }

    try {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL('offscreen/export-worker.html')]
      });

      if (existingContexts.length > 0) {
        this.isOffscreenReady = true;
        logger.log('Offscreen document already exists');
        return;
      }

      await chrome.offscreen.createDocument({
        url: 'offscreen/export-worker.html',
        reasons: ['DOM_PARSER'],
        justification: 'Generate CSV export files using third-party libraries'
      });

      this.isOffscreenReady = true;
      logger.log('Offscreen document created');

      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      logger.error('Error ensuring offscreen document:', error);
      throw error;
    }
  }

  async sendToOffscreen(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  getDefaultFields() {
    return [
      'filename',
      'fileUrl',
      'thumbnailUrl',
      'dimensions',
      'caption',
      'sourcePage',
      'pageNumber',
      'extractedAt'
    ];
  }

  async exportCSV(images, options = {}) {
    return await this.exportData('csv', images, options);
  }

  async exportXLSX(images, options = {}) {
    return await this.exportData('xlsx', images, options);
  }

  async exportJSON(images, options = {}) {
    return await this.exportData('json', images, options);
  }

  async exportHTML(images, options = {}) {
    return await this.exportData('html', images, options);
  }
}

export default ExportController;
