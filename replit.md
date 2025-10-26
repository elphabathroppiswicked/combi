# StepGallery - Chrome Extension Project

## Overview
StepGallery is a professional Chrome Extension (Manifest V3) that provides advanced image gallery detection, intelligent pagination, multi-format export capabilities, and batch downloading. This is a production-ready extension suitable for government and enterprise distribution.

**Version:** 3.0.0  
**Type:** Chrome Extension (Manifest V3)  
**Status:** Production-Ready

## Project Structure

This project contains:
1. **Chrome Extension Files** - The actual extension that runs in Chrome
2. **Demo Website** - Documentation and testing interface (for Replit)
3. **Test Gallery Page** - Sample gallery for testing the extension

### Key Directories
- `/icons/` - Extension icons (16x16, 48x48, 128x128)
- `/lib/` - Self-hosted libraries (PapaParse, SheetJS)
- `/src/` - Extension source code
  - `/src/background/` - Service worker modules
  - `/src/content/` - Content script modules (original)
  - `/src/shared/` - Shared utilities
  - `/src/ui/dashboard/` - Side panel interface
- `/offscreen/` - Offscreen worker for exports
- `manifest.json` - Extension configuration
- `background.js` - Service worker entry point
- `content-bundle.js` - Bundled content script

### Demo Files (Replit-specific)
- `index.html` - Documentation and installation guide
- `test-gallery.html` - Test page with sample image gallery
- `server.py` - Simple HTTP server for serving demo pages

## How to Use in Replit

The Replit environment serves a **demo website** that provides:
- Installation instructions for the Chrome extension
- Documentation of features
- A test gallery page for testing the extension after installation

### Accessing the Demo
The server is running on port 5000 and serves:
- **Main page:** `/` or `/index.html` - Installation guide
- **Test gallery:** `/test-gallery.html` - Sample gallery for testing

## Installing the Extension in Chrome

Since Chrome extensions cannot run directly in Replit's preview, users must:

1. **Download the Extension Files**
   - Download this entire repository/folder
   
2. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the folder containing `manifest.json`
   
3. **Test the Extension**
   - Open the test gallery page from this Replit
   - Click the StepGallery icon in Chrome toolbar
   - Side panel opens with gallery detection
   - Test pagination, export, and download features

## Key Features

### 🎯 Intelligent Gallery Detection
- Auto-detects image galleries on web pages
- Supports grid, masonry, carousel, and table layouts
- Configurable detection thresholds

### 📄 Advanced Pagination (7 Methods)
1. Next Button - Clicks "next" buttons
2. Load More - Handles "load more" buttons
3. Infinite Scroll - Scrolls to trigger lazy loading
4. Arrow Navigation - Clicks arrow icons
5. URL Pattern - Modifies URLs with page numbers
6. API-Based - Monitors network requests
7. Auto-Detect - Automatically selects best method

### 📊 Multi-Format Export
- CSV - Comma-separated values
- Excel (XLSX) - Full-featured spreadsheets
- JSON - Structured data
- HTML Report - Beautiful reports with thumbnails

### ⬇️ Batch Downloading
- Concurrent download management
- Custom filename patterns with tokens
- Retry logic for failed downloads
- Progress tracking

### 🔒 Security & Privacy
- Self-contained libraries (no CDN dependencies)
- Input sanitization on all user data
- Content hashing to prevent duplicate processing
- No external API calls or tracking
- Full Manifest V3 compliance

## Recent Changes

**October 26, 2025** - Replit Environment Setup
- Created demo website with installation instructions
- Added test gallery page for extension testing
- Set up Python HTTP server for serving static files
- Configured workflow to run server on port 5000
- Added .gitignore for Python and common files
- Created project documentation in replit.md

## Architecture

### Chrome Extension Architecture
- **Service Worker** (`background.js`) - Background processing
- **Content Scripts** (`content-bundle.js`) - Page interaction
- **Side Panel** (`dashboard.html`) - User interface
- **Offscreen Worker** (`export-worker.js`) - Export processing

### Technology Stack
- JavaScript (ES6+ modules)
- Chrome Extension APIs (Manifest V3)
- PapaParse (CSV generation)
- SheetJS (Excel generation)
- Python 3.11 (demo server only)

## Development Notes

### Chrome Extension Limitations in Replit
- Extensions cannot run in Replit's web preview (browser security)
- Users must download and load the extension in their local Chrome
- The Replit environment provides documentation and test pages only
- Test gallery page can be accessed via Replit preview

### Workflow Configuration
- **Server workflow** - Runs Python HTTP server on port 5000
- Serves static HTML files for documentation
- Cache-Control headers disabled for development

## User Preferences
- None specified yet

## Support

For issues or questions:
1. Check the README.md for detailed documentation
2. Review IMPLEMENTATION.md for technical details
3. Test with the provided test-gallery.html first
4. Check browser console for error messages
