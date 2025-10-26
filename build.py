#!/usr/bin/env python3
"""
Build script for StepGallery content-bundle.js
Bundles all content script modules into a single IIFE file
"""

import os
import re

def read_file(path):
    """Read file content"""
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def remove_imports_exports(content):
    """Remove ES6 import/export statements"""
    # Remove import statements
    content = re.sub(r'import\s+{[^}]*}\s+from\s+[\'"][^\'"]+[\'"];?\s*\n?', '', content)
    content = re.sub(r'import\s+\w+\s+from\s+[\'"][^\'"]+[\'"];?\s*\n?', '', content)
    
    # Remove export statements
    content = re.sub(r'export\s+{[^}]*};?\s*\n?', '', content)
    content = re.sub(r'export\s+default\s+(\w+);?\s*\n?', '', content)
    content = re.sub(r'export\s+class\s+', 'class ', content)
    content = re.sub(r'export\s+function\s+', 'function ', content)
    content = re.sub(r'export\s+const\s+', 'const ', content)
    
    return content

def build_bundle():
    """Build the content-bundle.js file"""
    
    base_path = os.path.dirname(os.path.abspath(__file__))
    
    # Read all source files in order
    files = [
        'src/shared/constants.js',
        'src/shared/logger.js',
        'src/shared/input-sanitizer.js',
        'src/shared/content-hasher.js',
        'src/content/network-monitor.js',
        'src/content/image-extractor.js',
        'src/content/gallery-detector.js',
        'src/content/pagination-engine.js',
        'src/content/content-main.js'
    ]
    
    bundle_content = "(function() {\n  'use strict';\n\n"
    
    for file_path in files:
        full_path = os.path.join(base_path, file_path)
        if os.path.exists(full_path):
            print(f"Processing: {file_path}")
            content = read_file(full_path)
            content = remove_imports_exports(content)
            
            # Add file header comment
            bundle_content += f"  // ===== {file_path} =====\n"
            
            # Indent content
            lines = content.split('\n')
            for line in lines:
                if line.strip():
                    bundle_content += '  ' + line + '\n'
                else:
                    bundle_content += '\n'
            
            bundle_content += '\n'
        else:
            print(f"Warning: File not found: {file_path}")
    
    bundle_content += "})();\n"
    
    # Write bundle
    output_path = os.path.join(base_path, 'content-bundle.js')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(bundle_content)
    
    print(f"\n✅ Bundle created: {output_path}")
    print(f"   Size: {len(bundle_content)} bytes")

if __name__ == '__main__':
    build_bundle()
