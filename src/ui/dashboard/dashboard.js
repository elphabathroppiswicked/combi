import { MESSAGE_TYPES, DEFAULT_SETTINGS } from '../../shared/constants.js';
import { FilenameGenerator } from '../../shared/filename-generator.js';

const filenameGenerator = new FilenameGenerator();

let collectedImages = [];
let isPaginating = false;
let settings = {
  paginationMethod: 'auto',
  filenamePattern: '*num-3*-*name*.*ext*',
  exportFormats: ['csv'],
  exportFields: ['filename', 'fileUrl', 'dimensions', 'sourcePage'],
  exportMode: 'full'
};

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Dashboard initializing...');
  
  await loadSettings();
  await loadImages();
  initializeUI();
  setupEventListeners();
  requestGalleryDetection();
  
  console.log('Dashboard ready');
});

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SETTINGS_GET });
    if (response && response.success) {
      settings = { ...settings, ...response.settings };
      applySettings();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function loadImages() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_IMAGES });
    if (response && response.success) {
      collectedImages = response.images || [];
      updateImageDisplay();
    }
  } catch (error) {
    console.error('Error loading images:', error);
  }
}

function applySettings() {
  document.getElementById('paginationMethod').value = settings.paginationMethod;
  document.getElementById('filenamePattern').value = settings.filenamePattern;
  
  if (settings.paginationDelay !== undefined) {
    document.getElementById('paginationDelay').value = settings.paginationDelay;
  }
  if (settings.scrollDelay !== undefined) {
    document.getElementById('scrollDelay').value = settings.scrollDelay;
  }
  if (settings.concurrentDownloads !== undefined) {
    document.getElementById('concurrentDownloads').value = settings.concurrentDownloads;
    document.getElementById('concurrentValue').textContent = settings.concurrentDownloads;
  }
  if (settings.downloadDelay !== undefined) {
    document.getElementById('downloadDelay').value = settings.downloadDelay;
  }
  if (settings.batchSize !== undefined) {
    document.getElementById('batchSize').value = settings.batchSize;
  }
  if (settings.downloadFolder !== undefined) {
    document.getElementById('downloadFolder').value = settings.downloadFolder;
  }
  
  if (settings.exportMode !== undefined) {
    const modeRadio = document.querySelector(`input[name="exportMode"][value="${settings.exportMode}"]`);
    if (modeRadio) {
      modeRadio.checked = true;
    }
    toggleExportMode(settings.exportMode);
  }
  
  updateFilenameExample();
}

function toggleExportMode(mode) {
  const formatSelection = document.querySelector('.format-selection');
  const fieldSelection = document.querySelector('.field-selection');
  const csvOnlyMessage = document.querySelector('.csv-only-message');
  
  if (mode === 'csv-only') {
    document.getElementById('exportCSV').checked = true;
    document.getElementById('exportXLSX').checked = false;
    document.getElementById('exportJSON').checked = false;
    document.getElementById('exportHTML').checked = false;
    
    formatSelection.style.display = 'none';
    fieldSelection.style.display = 'none';
    csvOnlyMessage.style.display = 'block';
  } else {
    formatSelection.style.display = 'flex';
    fieldSelection.style.display = 'block';
    csvOnlyMessage.style.display = 'none';
  }
}

function initializeUI() {
  updateImageStats();
  updateFilenameExample();
}

function setupEventListeners() {
  document.getElementById('startPagination').addEventListener('click', startPagination);
  document.getElementById('stopPagination').addEventListener('click', stopPagination);
  document.getElementById('clearImages').addEventListener('click', clearImages);
  document.getElementById('exportAllFormats').addEventListener('click', exportAllFormats);
  document.getElementById('downloadImages').addEventListener('click', downloadAllImages);

  document.getElementById('paginationMethod').addEventListener('change', (e) => {
    settings.paginationMethod = e.target.value;
    saveSettings();
  });

  document.getElementById('filenamePattern').addEventListener('input', (e) => {
    settings.filenamePattern = e.target.value;
    updateFilenameExample();
    saveSettings();
  });

  document.querySelectorAll('.token-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('filenamePattern');
      input.value += btn.dataset.token;
      settings.filenamePattern = input.value;
      updateFilenameExample();
      saveSettings();
    });
  });

  document.getElementById('paginationDelay').addEventListener('input', (e) => {
    settings.paginationDelay = parseFloat(e.target.value) || 0;
    saveSettings();
  });

  document.getElementById('scrollDelay').addEventListener('input', (e) => {
    settings.scrollDelay = parseInt(e.target.value) || 0;
    saveSettings();
  });

  document.getElementById('concurrentDownloads').addEventListener('input', (e) => {
    const value = parseInt(e.target.value) || 1;
    settings.concurrentDownloads = Math.max(1, Math.min(10, value));
    document.getElementById('concurrentValue').textContent = settings.concurrentDownloads;
    e.target.value = settings.concurrentDownloads;
    saveSettings();
  });

  document.getElementById('downloadDelay').addEventListener('input', (e) => {
    settings.downloadDelay = parseFloat(e.target.value) || 0;
    saveSettings();
  });

  document.getElementById('batchSize').addEventListener('input', (e) => {
    settings.batchSize = parseInt(e.target.value) || 0;
    saveSettings();
  });

  document.getElementById('downloadFolder').addEventListener('input', (e) => {
    const folder = e.target.value.trim();
    settings.downloadFolder = folder;
    validateFolderPath(folder);
    saveSettings();
  });

  document.querySelectorAll('input[name="exportMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      settings.exportMode = e.target.value;
      toggleExportMode(e.target.value);
      saveSettings();
    });
  });

  const numericInputs = [
    { id: 'paginationDelay', min: 0, max: 30 },
    { id: 'scrollDelay', min: 0, max: 5000 },
    { id: 'downloadDelay', min: 0, max: 60 },
    { id: 'batchSize', min: 0, max: 1000 }
  ];

  numericInputs.forEach(({ id, min, max }) => {
    const input = document.getElementById(id);
    input.addEventListener('blur', (e) => {
      validateNumericInput(e.target, min, max);
    });
    input.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (value < min || value > max) {
        e.target.classList.add('input-invalid');
      } else {
        e.target.classList.remove('input-invalid');
      }
    });
  });

  document.getElementById('filenamePattern').addEventListener('input', (e) => {
    const pattern = e.target.value;
    settings.filenamePattern = pattern;
    validateFilenamePattern(pattern);
    updateFilenameExample();
    saveSettings();
  });

  document.getElementById('helpToggle').addEventListener('click', toggleHelpSection);

  document.getElementById('resetSettings').addEventListener('click', resetToDefaults);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'gallery-status-update') {
      updateGalleryStatus(message.data);
    }
    if (message.type === 'images-update') {
      collectedImages = message.images || [];
      updateImageDisplay();
    }
    if (message.type === 'pagination-status-update') {
      updatePaginationStatus(message.data);
    }
    if (message.type === 'download/progress') {
      updateDownloadProgress(message.data);
    }
    if (message.type === 'download/complete') {
      updateDownloadComplete(message.data);
    }
    if (message.type === 'download/batch-confirm') {
      handleBatchConfirmation(message.data);
    }
  });
}

async function handleBatchConfirmation(data) {
  const continueDownload = confirm(
    `Downloaded ${data.downloaded} images so far.\n\n` +
    `Remaining: ${data.remaining}\n\n` +
    `Continue downloading?`
  );

  try {
    await chrome.runtime.sendMessage({
      type: 'download/batch-response',
      continue: continueDownload
    });
  } catch (error) {
    console.error('Error sending batch response:', error);
  }
}

async function saveSettings() {
  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SETTINGS_UPDATE,
      settings: settings
    });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

async function requestGalleryDetection() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'detect-gallery' });
    }
  } catch (error) {
    console.error('Error requesting gallery detection:', error);
    document.getElementById('galleryMessage').textContent = 'Could not detect gallery on this page';
  }
}

async function startPagination() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      alert('No active tab found');
      return;
    }

    isPaginating = true;
    
    await chrome.tabs.sendMessage(tabs[0].id, {
      type: MESSAGE_TYPES.CORE_PAGINATION_START,
      method: settings.paginationMethod
    });

    document.getElementById('paginationMessage').textContent = 'Pagination started...';
    document.getElementById('startPagination').disabled = true;
    document.getElementById('stopPagination').disabled = false;

  } catch (error) {
    console.error('Error starting pagination:', error);
    alert('Error starting pagination: ' + error.message);
  }
}

async function stopPagination() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await chrome.tabs.sendMessage(tabs[0].id, {
        type: MESSAGE_TYPES.CORE_PAGINATION_STOP
      });
    }

    isPaginating = false;
    document.getElementById('paginationMessage').textContent = 'Pagination stopped';
    document.getElementById('startPagination').disabled = false;
    document.getElementById('stopPagination').disabled = true;

  } catch (error) {
    console.error('Error stopping pagination:', error);
  }
}

async function clearImages() {
  if (!confirm('Clear all collected images?')) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CLEAR_IMAGES });
    collectedImages = [];
    updateImageDisplay();
  } catch (error) {
    console.error('Error clearing images:', error);
  }
}

async function exportAllFormats() {
  if (collectedImages.length === 0) {
    alert('No images to export');
    return;
  }

  const isCsvOnlyMode = settings.exportMode === 'csv-only';
  
  let formats = [];
  let fields = [];
  
  if (isCsvOnlyMode) {
    formats = ['csv'];
    fields = ['filename', 'fileUrl', 'thumbnailUrl', 'dimensions', 'caption', 'sourcePage', 'pageNumber', 'extractedAt'];
  } else {
    if (document.getElementById('exportCSV').checked) formats.push('csv');
    if (document.getElementById('exportXLSX').checked) formats.push('xlsx');
    if (document.getElementById('exportJSON').checked) formats.push('json');
    if (document.getElementById('exportHTML').checked) formats.push('html');

    if (formats.length === 0) {
      alert('Please select at least one export format');
      return;
    }

    fields = Array.from(document.querySelectorAll('.export-field:checked'))
      .map(cb => cb.value);

    if (fields.length === 0) {
      alert('Please select at least one field to export');
      return;
    }
  }

  try {
    for (const format of formats) {
      await chrome.runtime.sendMessage({
        type: `export/${format}`,
        data: {
          images: collectedImages,
          fields: fields,
          filename: `stepgallery-export-${Date.now()}`
        }
      });
    }

    if (isCsvOnlyMode) {
      alert(`✓ CSV export complete!\n\nExported ${collectedImages.length} image(s) with all fields included.`);
    } else {
      alert(`Successfully exported ${formats.length} format(s)`);
    }
  } catch (error) {
    console.error('Error exporting:', error);
    alert('Error exporting: ' + error.message);
  }
}

async function downloadAllImages() {
  if (collectedImages.length === 0) {
    alert('No images to download');
    return;
  }

  try {
    document.getElementById('downloadStatus').style.display = 'block';
    document.getElementById('downloadMessage').textContent = 'Starting download...';

    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.DOWNLOAD_START,
      images: collectedImages,
      options: {
        filenamePattern: settings.filenamePattern
      }
    });

  } catch (error) {
    console.error('Error downloading images:', error);
    alert('Error downloading images: ' + error.message);
  }
}

function updateGalleryStatus(data) {
  const messageEl = document.getElementById('galleryMessage');
  const typeEl = document.getElementById('galleryType');
  const countEl = document.getElementById('imageCount');
  const confidenceEl = document.getElementById('confidence');

  if (data.isGallery) {
    messageEl.textContent = '✓ Gallery detected!';
    messageEl.style.color = '#4CAF50';
    typeEl.textContent = `Type: ${data.galleryType}`;
    countEl.textContent = `Images: ${data.imageCount}`;
    confidenceEl.textContent = `Confidence: ${(data.confidence * 100).toFixed(0)}%`;
  } else {
    messageEl.textContent = 'No gallery detected';
    messageEl.style.color = '#f44336';
    typeEl.textContent = '';
    countEl.textContent = '';
    confidenceEl.textContent = '';
  }
}

function updatePaginationStatus(data) {
  const messageEl = document.getElementById('paginationMessage');
  const statsEl = document.getElementById('paginationStats');
  const progressEl = document.getElementById('progressFill');

  messageEl.textContent = data.message || 'Paginating...';
  statsEl.textContent = `Page: ${data.currentPage || 1} | Method: ${data.method || 'auto'}`;

  if (data.status === 'complete') {
    progressEl.style.width = '100%';
    document.getElementById('startPagination').disabled = false;
    document.getElementById('stopPagination').disabled = true;
    isPaginating = false;
  } else {
    const progress = Math.min((data.currentPage || 1) * 2, 100);
    progressEl.style.width = `${progress}%`;
  }
}

function updateImageDisplay() {
  updateImageStats();

  const grid = document.getElementById('imageGrid');
  grid.innerHTML = '';

  collectedImages.slice(0, 50).forEach((image, index) => {
    const item = document.createElement('div');
    item.className = 'image-item';
    
    const img = document.createElement('img');
    img.src = image.thumbnailUrl || image.fileUrl;
    img.alt = image.caption || `Image ${index + 1}`;
    img.loading = 'lazy';
    img.onerror = () => {
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E?%3C/text%3E%3C/svg%3E';
    };

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.textContent = image.filename || 'image.jpg';

    item.appendChild(img);
    item.appendChild(overlay);
    grid.appendChild(item);
  });

  if (collectedImages.length > 50) {
    const more = document.createElement('div');
    more.className = 'image-item';
    more.style.background = '#2196F3';
    more.style.color = 'white';
    more.style.display = 'flex';
    more.style.alignItems = 'center';
    more.style.justifyContent = 'center';
    more.style.fontSize = '14px';
    more.style.fontWeight = 'bold';
    more.textContent = `+${collectedImages.length - 50}`;
    grid.appendChild(more);
  }
}

function updateImageStats() {
  document.getElementById('totalImages').textContent = `${collectedImages.length} image${collectedImages.length !== 1 ? 's' : ''}`;
}

function updateFilenameExample() {
  const pattern = document.getElementById('filenamePattern').value;
  const example = generateFilenameExample(pattern);
  document.getElementById('filenameExample').textContent = example;
}

function generateFilenameExample(pattern) {
  const sampleImage = {
    filename: 'sunset.jpg',
    fileUrl: 'https://www.imago-images.com/bild/st/0492917022/sunset.jpg',
    sourcePage: 'https://example.com/gallery',
    pageNumber: 1,
    caption: 'Beautiful Sunset'
  };

  return filenameGenerator.generate(sampleImage, pattern, 0);
}

function updateDownloadProgress(data) {
  const statusEl = document.getElementById('downloadStatus');
  const messageEl = document.getElementById('downloadMessage');
  const progressEl = document.getElementById('downloadProgress');
  const statsEl = document.getElementById('downloadStats');

  statusEl.style.display = 'block';
  messageEl.textContent = 'Downloading images...';
  progressEl.style.width = `${data.progress}%`;
  statsEl.textContent = `Downloaded: ${data.downloaded} | Failed: ${data.failed} | Remaining: ${data.remaining}`;
}

function updateDownloadComplete(data) {
  const messageEl = document.getElementById('downloadMessage');
  const statsEl = document.getElementById('downloadStats');

  messageEl.textContent = 'Download complete!';
  messageEl.style.color = '#4CAF50';
  statsEl.textContent = `Total: ${data.total} | Downloaded: ${data.downloaded} | Failed: ${data.failed}`;

  setTimeout(() => {
    document.getElementById('downloadStatus').style.display = 'none';
  }, 5000);
}

function validateNumericInput(input, min, max) {
  let value = parseFloat(input.value);
  
  if (isNaN(value) || value === '') {
    value = min;
  }
  
  if (value < min) {
    value = min;
  } else if (value > max) {
    value = max;
  }
  
  input.value = value;
  input.classList.remove('input-invalid');
  
  const inputId = input.id;
  if (inputId === 'paginationDelay') {
    settings.paginationDelay = value;
  } else if (inputId === 'scrollDelay') {
    settings.scrollDelay = value;
  } else if (inputId === 'downloadDelay') {
    settings.downloadDelay = value;
  } else if (inputId === 'batchSize') {
    settings.batchSize = value;
  }
  
  saveSettings();
}

function validateFilenamePattern(pattern) {
  const patternWarning = document.getElementById('patternWarning');
  const input = document.getElementById('filenamePattern');
  
  const hasRequiredToken = pattern.includes('*name*') || 
                           pattern.includes('*num*') || 
                           pattern.includes('*num-3*') || 
                           pattern.includes('*num-5*');
  
  if (!hasRequiredToken) {
    patternWarning.textContent = 'Pattern must include at least one of: *name*, *num*, *num-3*, or *num-5*';
    patternWarning.style.display = 'flex';
    input.classList.add('input-invalid');
  } else {
    patternWarning.style.display = 'none';
    input.classList.remove('input-invalid');
  }
}

function validateFolderPath(path) {
  const folderWarning = document.getElementById('folderWarning');
  const input = document.getElementById('downloadFolder');
  
  if (!path) {
    folderWarning.style.display = 'none';
    input.classList.remove('input-invalid');
    return;
  }
  
  const invalidChars = /[<>:"|?*\\/]/;
  
  if (invalidChars.test(path)) {
    folderWarning.textContent = 'Folder name contains invalid characters: < > : " | ? * \\ /';
    folderWarning.style.display = 'flex';
    input.classList.add('input-invalid');
  } else {
    folderWarning.style.display = 'none';
    input.classList.remove('input-invalid');
  }
}

function toggleHelpSection() {
  const helpSection = document.getElementById('helpSection');
  const helpToggle = document.getElementById('helpToggle');
  
  if (helpSection.style.display === 'none' || !helpSection.classList.contains('open')) {
    helpSection.style.display = 'block';
    setTimeout(() => {
      helpSection.classList.add('open');
    }, 10);
    helpToggle.textContent = '📖 Hide Help & Token Reference';
  } else {
    helpSection.classList.remove('open');
    setTimeout(() => {
      helpSection.style.display = 'none';
    }, 400);
    helpToggle.textContent = '📖 Show Help & Token Reference';
  }
}

async function resetToDefaults() {
  const confirmed = confirm(
    '⚠️ Reset all settings to defaults?\n\n' +
    'This will restore all pagination, download, and export settings to their default values.\n\n' +
    'This action cannot be undone.'
  );
  
  if (!confirmed) {
    return;
  }
  
  settings = { ...DEFAULT_SETTINGS };
  
  applySettings();
  
  await saveSettings();
  
  validateFilenamePattern(settings.filenamePattern);
  validateFolderPath(settings.downloadFolder || '');
  
  alert('✅ All settings have been reset to defaults!');
}
