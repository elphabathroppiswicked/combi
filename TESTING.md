# Testing Instructions for Lazy Loading Improvements

## Quick Start

### 1. Load the Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `/home/runner/work/combi/combi` directory
5. Extension should appear in your toolbar

### 2. Test with Lazy Loading Test Page

#### Option A: Using Local Server
```bash
cd /home/runner/work/combi/combi
python3 server.py
# Open http://localhost:5000/test-lazy-loading.html in Chrome
```

#### Option B: Direct File Access
- Open `test-lazy-loading.html` directly in Chrome
- File path: `/home/runner/work/combi/combi/test-lazy-loading.html`

### 3. Verify Functionality

1. **Open the Extension Panel**
   - Click the StepGallery icon in Chrome toolbar
   - Side panel should open on the right

2. **Extract Images**
   - Click "Extract Images" button
   - Watch the page scroll automatically (this is the new feature!)
   - Images should load as they enter viewport

3. **Check Results**
   - Open Chrome DevTools (F12)
   - Check Console tab
   - Look for logs like:
     ```
     [ImageExtractor] Starting lazy loading trigger with IntersectionObserver
     [ImageExtractor] Completed X scroll steps to trigger lazy loading
     [ImageExtractor] Extracted 30 images from page 1
     ```

4. **Verify in Extension Panel**
   - Should show ~30 images detected
   - All images should have proper URLs (not data: URLs)

## Expected Behavior

### ✅ What Should Happen
- Extension automatically scrolls through the page
- Native lazy-loaded images (`loading="lazy"`) are triggered
- Data-src images are detected via attributes
- All 30 test images are extracted
- Original scroll position is restored
- No console errors

### ❌ What Should NOT Happen
- Manual scrolling required
- Missing images
- Memory leaks (check Chrome Task Manager)
- Errors in console
- Extension freeze or crash

## Test Cases

### Test Case 1: Native Lazy Loading (Section 1)
- **Images**: 10 images with `loading="lazy"` attribute
- **Expected**: All images extracted after scrolling
- **Badge Color**: Green (Native)

### Test Case 2: Data-src Lazy Loading (Section 2)
- **Images**: 10 images with `data-src` attribute
- **Expected**: All images extracted (both methods work)
- **Badge Color**: Yellow (data-src)

### Test Case 3: Mixed Approach (Section 3)
- **Images**: 10 images, alternating native and data-src
- **Expected**: All images extracted regardless of method
- **Badge Colors**: Mix of green and yellow

## Performance Metrics

Check these in Chrome DevTools:

### Console Timing
```
[ImageExtractor] Starting lazy loading trigger with IntersectionObserver
[ImageExtractor] Completed X scroll steps to trigger lazy loading
[ImageExtractor] Lazy loading triggered, Y images loaded
[ImageExtractor] Extracted 30 images from page 1
```

### Memory Usage
- Open Chrome Task Manager (Shift+Esc)
- Check StepGallery extension memory
- Should be < 100MB
- Should not increase after reset()

### Network Activity
- Open DevTools Network tab
- Should see ~30 image requests to picsum.photos
- Images should load as page scrolls

## Advanced Testing

### Test with Real Websites
Try these popular sites with lazy loading:

1. **Unsplash** (https://unsplash.com)
   - Heavy use of lazy loading
   - Should extract all visible images

2. **Medium** (https://medium.com)
   - Progressive image loading
   - Should handle gracefully

3. **Pinterest** (https://pinterest.com)
   - Infinite scroll with lazy loading
   - Test pagination + lazy loading

### Configuration Testing

Test different settings via extension panel:

1. **Fast Scroll** (scrollDelay: 200ms)
   - Faster extraction
   - May miss some images on slow connections

2. **Slow Scroll** (scrollDelay: 1000ms)
   - More reliable on slow sites
   - Takes longer

3. **Few Steps** (maxScrollSteps: 5)
   - Only scrolls 5 times
   - Good for short pages

4. **Many Steps** (maxScrollSteps: 30)
   - Scrolls up to 30 times
   - Good for very long pages

## Troubleshooting

### Issue: No Images Extracted
**Solution**: 
- Check console for errors
- Verify extension is loaded
- Try reloading the page

### Issue: Some Images Missing
**Solution**:
- Increase scrollDelay in settings
- Increase maxScrollSteps
- Check if images are in iframes (not supported yet)

### Issue: Extension Slow
**Solution**:
- Decrease scrollDelay
- Decrease maxScrollSteps
- Clear browser cache

### Issue: Memory Leak
**Solution**:
- Click "Clear All" in extension
- Call reset() should clean up observers
- Check console for warnings

## Debugging

### Enable Debug Logging
Edit `src/shared/constants.js`:
```javascript
const DEV_MODE = true;  // Change from false
```
Then rebuild:
```bash
python3 build.py
```

### Manual Testing in Console
Open DevTools console and run:
```javascript
// Get the image extractor instance
// (requires access to content script context)

// Test lazy loading manually
await imageExtractor.extractImagesWithLazyLoading({
  scrollDelay: 500,
  maxScrollSteps: 20
});
```

## Success Criteria

All of these should be true:

- ✅ Extension loads without errors
- ✅ test-lazy-loading.html shows 30 images
- ✅ Extension extracts all 30 images
- ✅ Page scrolls automatically during extraction
- ✅ Original scroll position restored
- ✅ No console errors
- ✅ Memory usage stable (< 100MB)
- ✅ No memory leaks after reset
- ✅ Works with both native and data-src lazy loading
- ✅ Backward compatible (old method still works)

## Reporting Issues

If you find issues, please report:

1. Chrome version
2. Extension version
3. Test page used
4. Console errors (if any)
5. Expected vs actual behavior
6. Screenshots (if applicable)

## Additional Resources

- [LAZY_LOADING_IMPROVEMENTS.md](LAZY_LOADING_IMPROVEMENTS.md) - Technical details
- [verify-lazy-loading.js](verify-lazy-loading.js) - Logic verification
- [test-lazy-loading.html](test-lazy-loading.html) - Test page
- [build.py](build.py) - Build script

---

**Happy Testing! 🚀**
