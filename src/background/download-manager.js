import { Logger } from '../shared/logger.js';
import { InputSanitizer } from '../shared/input-sanitizer.js';
import { FilenameGenerator } from '../shared/filename-generator.js';
import { DOWNLOAD_CONFIG } from '../shared/constants.js';

const logger = new Logger('DownloadManager');

export class DownloadManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.sanitizer = new InputSanitizer();
    this.filenameGenerator = new FilenameGenerator();
    this.downloadQueue = [];
    this.isDownloading = false;
    this.activeDownloads = 0;
    this.downloadedCount = 0;
    this.failedCount = 0;
    this.batchCounter = 0;
    this.isPaused = false;
    this.pauseResolver = null;
  }

  resumeDownloads(shouldContinue) {
    if (this.pauseResolver) {
      this.pauseResolver(shouldContinue);
      this.pauseResolver = null;
    }
  }

  async downloadImages(images, options = {}) {
    const filenamePattern = options.filenamePattern || this.stateManager.getSettings().filenamePattern;
    const folder = options.folder || this.stateManager.getSettings().downloadFolder;

    logger.log(`Queuing ${images.length} images for download`);

    images.forEach((image, index) => {
      const filename = this.generateFilename(image, filenamePattern, index);
      const fullPath = folder ? `${folder}/${filename}` : filename;

      this.downloadQueue.push({
        url: image.fileUrl,
        filename: this.sanitizer.sanitizeFilename(fullPath),
        image: image,
        retries: 0
      });
    });

    if (!this.isDownloading) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.downloadQueue.length === 0) {
      this.isDownloading = false;
      this.notifyComplete();
      return;
    }

    this.isDownloading = true;

    const settings = this.stateManager.getSettings();
    const concurrentDownloads = settings.concurrentDownloads || DOWNLOAD_CONFIG.CONCURRENT_DOWNLOADS;

    while (this.downloadQueue.length > 0 && this.activeDownloads < concurrentDownloads) {
      const item = this.downloadQueue.shift();
      this.downloadItem(item);
    }
  }

  async downloadItem(item) {
    this.activeDownloads++;

    const settings = this.stateManager.getSettings();
    const downloadDelay = settings.downloadDelay || 0;
    const batchSize = settings.batchSize || 0;

    if (downloadDelay > 0) {
      await this.wait(downloadDelay * 1000);
    }

    if (batchSize > 0 && this.batchCounter >= batchSize) {
      const shouldContinue = await this.requestBatchConfirmation();
      if (!shouldContinue) {
        this.activeDownloads--;
        this.downloadQueue.unshift(item);
        this.isDownloading = false;
        logger.log('Download paused by user');
        return;
      }
      this.batchCounter = 0;
    }

    try {
      const downloadId = await chrome.downloads.download({
        url: item.url,
        filename: item.filename,
        saveAs: false
      });

      logger.log(`Download started: ${item.filename} (ID: ${downloadId})`);
      this.downloadedCount++;
      this.batchCounter++;

      this.notifyProgress();

    } catch (error) {
      logger.error(`Download failed: ${item.filename}`, error);

      if (item.retries < DOWNLOAD_CONFIG.RETRY_ATTEMPTS) {
        item.retries++;
        logger.log(`Retrying download (${item.retries}/${DOWNLOAD_CONFIG.RETRY_ATTEMPTS}): ${item.filename}`);
        
        setTimeout(() => {
          this.downloadQueue.push(item);
        }, DOWNLOAD_CONFIG.RETRY_DELAY * item.retries);
      } else {
        this.failedCount++;
        logger.error(`Download failed permanently: ${item.filename}`);
      }

      this.notifyProgress();
    }

    this.activeDownloads--;

    this.processQueue();
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async requestBatchConfirmation() {
    return new Promise((resolve) => {
      this.pauseResolver = resolve;
      
      try {
        chrome.runtime.sendMessage({
          type: 'download/batch-confirm',
          data: {
            downloaded: this.downloadedCount,
            remaining: this.downloadQueue.length + this.activeDownloads
          }
        }).catch(() => {
          logger.error('Error sending batch confirmation request');
          resolve(false);
        });
      } catch (error) {
        logger.error('Error requesting batch confirmation:', error);
        resolve(false);
      }
    });
  }

  generateFilename(image, pattern, index) {
    return this.filenameGenerator.generate(image, pattern, index);
  }

  notifyProgress() {
    const total = this.downloadedCount + this.failedCount + this.downloadQueue.length + this.activeDownloads;
    const completed = this.downloadedCount + this.failedCount;

    try {
      chrome.runtime.sendMessage({
        type: 'download/progress',
        data: {
          downloaded: this.downloadedCount,
          failed: this.failedCount,
          remaining: this.downloadQueue.length + this.activeDownloads,
          total: total,
          progress: total > 0 ? (completed / total) * 100 : 0
        }
      }).catch(() => {});
    } catch (error) {
      logger.debug('Error sending progress notification:', error);
    }
  }

  notifyComplete() {
    logger.log(`Download complete. Downloaded: ${this.downloadedCount}, Failed: ${this.failedCount}`);

    try {
      chrome.runtime.sendMessage({
        type: 'download/complete',
        data: {
          downloaded: this.downloadedCount,
          failed: this.failedCount,
          total: this.downloadedCount + this.failedCount
        }
      }).catch(() => {});
    } catch (error) {
      logger.debug('Error sending complete notification:', error);
    }

    this.downloadedCount = 0;
    this.failedCount = 0;
  }

  clearQueue() {
    this.downloadQueue = [];
    logger.log('Download queue cleared');
  }

  getStatus() {
    return {
      isDownloading: this.isDownloading,
      queueLength: this.downloadQueue.length,
      activeDownloads: this.activeDownloads,
      downloaded: this.downloadedCount,
      failed: this.failedCount
    };
  }
}

export default DownloadManager;
