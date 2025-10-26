console.log('StepGallery Export Worker initializing...');

const statusEl = document.getElementById('status');
statusEl.textContent = 'Ready';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Export worker received message:', message.type);

  if (message.type === 'export/csv') {
    handleCSVExport(message.data, sendResponse);
    return true;
  }

  if (message.type === 'export/xlsx') {
    handleXLSXExport(message.data, sendResponse);
    return true;
  }

  if (message.type === 'export/json') {
    handleJSONExport(message.data, sendResponse);
    return true;
  }

  if (message.type === 'export/html') {
    handleHTMLExport(message.data, sendResponse);
    return true;
  }

  return false;
});

async function handleCSVExport(data, sendResponse) {
  try {
    statusEl.textContent = 'Generating CSV...';
    
    const rows = data.images.map(img => {
      const row = {};
      data.fields.forEach(field => {
        row[field] = img[field] || '';
      });
      return row;
    });

    const csv = Papa.unparse(rows, {
      quotes: true,
      header: true,
      delimiter: ',',
      newline: '\n'
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `${data.filename}.csv`);

    statusEl.textContent = 'CSV export complete';
    sendResponse({ success: true, format: 'csv', rowCount: rows.length });

  } catch (error) {
    console.error('CSV export error:', error);
    statusEl.textContent = 'CSV export failed';
    sendResponse({ success: false, error: error.message });
  }
}

async function handleXLSXExport(data, sendResponse) {
  try {
    statusEl.textContent = 'Generating Excel...';

    const rows = data.images.map(img => {
      const row = {};
      data.fields.forEach(field => {
        row[field] = img[field] || '';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    const columnWidths = data.fields.map(field => ({ wch: 20 }));
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Images');

    const wbout = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array',
      compression: true
    });

    const blob = new Blob([wbout], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    downloadFile(blob, `${data.filename}.xlsx`);

    statusEl.textContent = 'Excel export complete';
    sendResponse({ success: true, format: 'xlsx', rowCount: rows.length });

  } catch (error) {
    console.error('XLSX export error:', error);
    statusEl.textContent = 'Excel export failed';
    sendResponse({ success: false, error: error.message });
  }
}

async function handleJSONExport(data, sendResponse) {
  try {
    statusEl.textContent = 'Generating JSON...';

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalImages: data.images.length,
        fields: data.fields,
        version: '3.0.0'
      },
      images: data.images
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadFile(blob, `${data.filename}.json`);

    statusEl.textContent = 'JSON export complete';
    sendResponse({ success: true, format: 'json', imageCount: data.images.length });

  } catch (error) {
    console.error('JSON export error:', error);
    statusEl.textContent = 'JSON export failed';
    sendResponse({ success: false, error: error.message });
  }
}

async function handleHTMLExport(data, sendResponse) {
  try {
    statusEl.textContent = 'Generating HTML...';

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StepGallery Export - ${data.images.length} Images</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 30px;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
    }
    .metadata {
      color: #666;
      margin-bottom: 30px;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th {
      background: #4CAF50;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
    }
    tr:hover {
      background: #f9f9f9;
    }
    img.thumbnail {
      max-width: 100px;
      max-height: 100px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    a {
      color: #2196F3;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .caption {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>StepGallery Export Report</h1>
    <div class="metadata">
      <strong>Export Date:</strong> ${new Date().toLocaleString()}<br>
      <strong>Total Images:</strong> ${data.images.length}<br>
      <strong>Fields:</strong> ${data.fields.join(', ')}
    </div>
    <table>
      <thead>
        <tr>`;

    data.fields.forEach(field => {
      html += `<th>${field}</th>`;
    });

    html += `
        </tr>
      </thead>
      <tbody>`;

    data.images.forEach((img, index) => {
      html += '<tr>';
      data.fields.forEach(field => {
        let value = img[field] || '';
        
        if (field === 'thumbnailUrl' && value) {
          html += `<td><img src="${escapeHtml(value)}" alt="Image ${index + 1}" class="thumbnail"></td>`;
        } else if ((field === 'fileUrl' || field.toLowerCase().includes('url')) && value) {
          const displayUrl = value.length > 50 ? value.substring(0, 47) + '...' : value;
          html += `<td><a href="${escapeHtml(value)}" target="_blank">${escapeHtml(displayUrl)}</a></td>`;
        } else if (field === 'caption') {
          html += `<td><div class="caption" title="${escapeHtml(value)}">${escapeHtml(value)}</div></td>`;
        } else {
          html += `<td>${escapeHtml(String(value))}</td>`;
        }
      });
      html += '</tr>';
    });

    html += `
      </tbody>
    </table>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    downloadFile(blob, `${data.filename}.html`);

    statusEl.textContent = 'HTML export complete';
    sendResponse({ success: true, format: 'html', imageCount: data.images.length });

  } catch (error) {
    console.error('HTML export error:', error);
    statusEl.textContent = 'HTML export failed';
    sendResponse({ success: false, error: error.message });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  
  // Send message to service worker to initiate download
  // chrome.downloads is not available in offscreen documents
  chrome.runtime.sendMessage({
    type: 'download/file',
    data: {
      url: url,
      filename: filename,
      saveAs: true
    }
  }, (response) => {
    if (response && response.success) {
      console.log(`Download started: ${filename} (ID: ${response.downloadId})`);
    } else {
      console.error(`Download failed: ${filename}`, response?.error);
    }
    
    // Revoke the object URL after a delay to allow the download to start
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);
  });
}

console.log('Export worker ready');
