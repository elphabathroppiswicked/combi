# Lazy Loading Improvements - Implementation Summary

## Overview
This implementation improves the ImageExtractor's handling of lazy-loaded images by using an IntersectionObserver to trigger the browser's native lazy loading mechanism, then capturing the populated `src` attributes.

## Problem Addressed
Previously, the ImageExtractor only looked for lazy-loaded images by checking data attributes like `data-src`, `data-lazy`, etc. This approach had limitations:
- It couldn't detect images that use native browser lazy loading (`loading="lazy"`)
- It missed images that populate their `src` attribute dynamically when entering the viewport
- It required the page to be manually scrolled to trigger lazy loading

## Solution
The new implementation uses a two-pronged approach:

### 1. IntersectionObserver-Based Triggering
- Scrolls through the page systematically to trigger lazy loading
- Uses IntersectionObserver to detect when images enter the viewport
- Monitors images for `src` attribute changes using MutationObserver
- Captures the fully-loaded image URLs after lazy loading completes

### 2. Fallback to Data Attributes
- Still supports the original data-src attribute detection
- Provides backward compatibility with sites using traditional lazy loading libraries
- Works as a fallback when native lazy loading isn't triggered

## Key Changes

### ImageExtractor Class (src/content/image-extractor.js)

#### New Constructor Properties
```javascript
this.lazyLoadObserver = null;          // IntersectionObserver instance
this.observedImages = new Set();        // Track observed images
this.lazyLoadedImages = new Set();      // Track loaded images
```

#### New Methods

1. **`triggerLazyLoading(options)`**
   - Main method to trigger lazy loading across the page
   - Initializes the IntersectionObserver
   - Scrolls through the page to load images
   - Options: `scrollDelay` (ms between scrolls), `maxScrollSteps` (max scroll iterations)

2. **`initializeLazyLoadObserver()`**
   - Creates and configures the IntersectionObserver
   - Watches for images entering the viewport
   - Triggers `monitorImageSrcChange()` when images intersect

3. **`monitorImageSrcChange(img)`**
   - Uses MutationObserver to watch for `src` attribute changes
   - Detects when lazy-loaded images populate their src
   - Auto-disconnects after 10 seconds to prevent memory leaks

4. **`scrollToTriggerLazyLoad(scrollDelay, maxScrollSteps)`**
   - Smoothly scrolls through the page in steps
   - Scrolls 75% of viewport height each step
   - Restores original scroll position when done
   - Waits between scrolls to allow images to load

5. **`extractImagesWithLazyLoading(options)`**
   - Public API that combines lazy loading with extraction
   - First triggers lazy loading, then extracts images
   - Returns Promise with array of extracted images

6. **`waitForContent(ms)`**
   - Helper method for delays
   - Returns a Promise that resolves after specified time

#### Modified Methods

- **`extractImages()`**: Now async to support lazy loading
- **`reset()`**: Cleans up observers to prevent memory leaks

### Content Main (src/content/content-main.js)

#### Updated Message Handlers

1. **`handlePaginationStart()`**
   - Now uses `extractImagesWithLazyLoading()` instead of `extractImages()`
   - Passes scroll delay from settings
   - Uses fewer scroll steps during pagination (10 vs 20) for performance

2. **`handleExtractImages()`**
   - Now async to support lazy loading
   - Supports `useLazyLoading` flag in message (defaults to true)
   - Reads `scrollDelay` from settings
   - Falls back to regular extraction if lazy loading disabled

## Testing

### Test File: test-lazy-loading.html
A comprehensive test page with:
- 30 images across 3 sections
- Native lazy loading (`loading="lazy"`)
- Data-src lazy loading
- Mixed approach
- Large spacers to test scrolling behavior

### How to Test
1. Load the extension in Chrome
2. Open `test-lazy-loading.html` in the browser
3. Click the extension icon to open the side panel
4. Click "Extract Images" or start pagination
5. Verify all 30 images are extracted (check console logs)

### Expected Behavior
- Extension scrolls through page automatically
- Images load as they enter viewport
- All images extracted regardless of lazy loading method
- Original scroll position restored
- Console shows: "Extracted X images from page 1"

## Configuration

### Settings Used
- **`scrollDelay`**: Delay between scroll steps (default: 500ms)
  - Increase for slow-loading pages
  - Decrease for faster extraction
- **`maxScrollSteps`**: Maximum scroll iterations (default: 20 for initial, 10 for pagination)
  - Prevents infinite scrolling
  - Adjust based on page length

## Performance Considerations

### Memory Management
- IntersectionObserver and MutationObservers are properly disconnected
- `reset()` method cleans up all observers
- MutationObservers auto-disconnect after 10 seconds
- Image sets are cleared on reset

### Optimization
- Smooth scrolling uses CSS animations (GPU accelerated)
- Only observes images not already tracked
- Scroll steps are 75% of viewport (good balance)
- Fewer scroll steps during pagination (10 vs 20)

## Backward Compatibility

The implementation maintains full backward compatibility:
- Original data-src detection still works
- Can disable lazy loading via `useLazyLoading: false` flag
- Falls back to sync extraction if needed
- All existing functionality preserved

## Browser Support

Requires modern browser features:
- IntersectionObserver API (Chrome 51+, all modern browsers)
- MutationObserver API (Chrome 18+, all modern browsers)
- Promises and async/await (Chrome 55+)
- Native lazy loading support (Chrome 76+, but graceful fallback)

All target browsers for Chrome Extension MV3 support these features.

## Future Enhancements

Possible improvements:
- Adaptive scroll delay based on network speed
- Virtual scrolling for very long pages
- Support for lazy loading in iframes
- Parallel observation of multiple containers
- Smart detection of lazy loading libraries

## Build Process

### build.py Script
- Bundles ES6 modules into single IIFE file
- Removes import/export statements
- Preserves code structure and comments
- Generates content-bundle.js for extension

### Usage
```bash
python3 build.py
```

This regenerates `content-bundle.js` from source files in `src/` directory.
