import { Logger } from './src/shared/logger.js';
import { StateManager } from './src/background/state-manager.js';
import { DownloadManager } from './src/background/download-manager.js';
import { ExportController } from './src/background/export-controller.js';
import { MessageRouter } from './src/background/message-router.js';

const logger = new Logger('Background');

const state = new StateManager();
const downloads = new DownloadManager(state);
const exports = new ExportController();
const router = new MessageRouter({ state, downloads, exports });

async function initialize() {
  logger.log('StepGallery service worker initializing');

  await state.initialize();

  logger.log('StepGallery service worker ready');
}

chrome.runtime.onInstalled.addListener((details) => {
  logger.log('Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    logger.log('First install, setting up defaults');
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    logger.error('Error opening side panel:', error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const result = router.handle(message, sender, sendResponse);
  return result;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (state.getCurrentTab() === tabId) {
    logger.log(`Current tab ${tabId} closed`);
  }
});

initialize();
