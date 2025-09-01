# Webview Assets

This directory contains the separated HTML, CSS, and JavaScript files for the search webview panel.

## Files

- **search.html**: The HTML template for the search interface
- **search.css**: All CSS styles for the webview interface
- **search.js**: All JavaScript logic for the webview functionality

## Benefits of Separation

1. **Better IDE Support**: Full syntax highlighting, IntelliSense, and error detection
2. **Easier Debugging**: Can use browser dev tools more effectively
3. **Better Maintainability**: Cleaner separation of concerns
4. **Version Control**: Better diff tracking and conflict resolution
5. **Reusability**: Components can be easily reused or extracted

## Template Placeholders

The HTML template uses the following placeholders that are replaced at runtime:

- `{{cssUri}}`: URI to the CSS file
- `{{jsUri}}`: URI to the JavaScript file  
- `{{initialData}}`: Initial search results and configuration data
- `{{searchType}}`: The type of search ('file' or 'folder')

## Usage

The `SearchWebviewPanel` class loads these files using VS Code's webview URI system to ensure proper security and resource loading.
