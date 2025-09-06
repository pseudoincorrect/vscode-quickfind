const vscode = acquireVsCodeApi();
let results = [];
let selectedIndex = 0;
let searchTimeout = null;
let currentSearchQuery = '';
let workspacePath = '';
let displayedResults = 50; // Initially show only 50 results
let currentSearchType = 'folder';
let maxResults = 1000;
const INITIAL_BATCH_SIZE = 50;
const LOAD_MORE_BATCH_SIZE = 25;

// Search history management
let searchHistory = [];
let historyIndex = -1;
const HISTORY_FILE = '/tmp/vscode-quickfind-text-search-history.json';
const MAX_HISTORY_SIZE = 50;

const searchInput = document.querySelector('.search-input');
const resultsList = document.getElementById('resultsList');
const contextPanel = document.getElementById('contextPanel');
const resultCount = document.getElementById('resultCount');

// Toggle buttons
const caseSensitiveToggle = document.getElementById('caseSensitiveToggle');
const wholeWordToggle = document.getElementById('wholeWordToggle');

// Search configuration state
let searchConfig = {
    caseSensitive: false,
    wholeWord: false
};

// Load search history from file
function loadSearchHistory() {
    vscode.postMessage({ command: 'loadHistory', file: HISTORY_FILE });
}

// Save search history to file
function saveSearchHistory() {
    vscode.postMessage({ command: 'saveHistory', file: HISTORY_FILE, history: searchHistory });
}

// Add search to history
function addToHistory(query) {
    if (!query || query.trim() === '') return;
    
    // Remove if already exists to move to top
    const index = searchHistory.indexOf(query);
    if (index > -1) {
        searchHistory.splice(index, 1);
    }
    
    // Add to beginning
    searchHistory.unshift(query);
    
    // Limit history size
    if (searchHistory.length > MAX_HISTORY_SIZE) {
        searchHistory = searchHistory.slice(0, MAX_HISTORY_SIZE);
    }
    
    saveSearchHistory();
}

// Initialize search configuration
function initializeSearchConfig() {
    // Request initial config from the extension
    vscode.postMessage({ command: 'loadConfig' });
    
    // Setup toggle button event listeners
    caseSensitiveToggle.addEventListener('click', () => {
        searchConfig.caseSensitive = !searchConfig.caseSensitive;
        updateToggleButtons();
        // Invert logic: UI caseSensitive means config case-sensitive should be false
        vscode.postMessage({ 
            command: 'updateConfig', 
            config: { 'case-sensitive': !searchConfig.caseSensitive } 
        });
        
        // Re-search with new configuration if there's a query
        if (searchInput.value.trim()) {
            vscode.postMessage({ command: 'search', query: searchInput.value });
        }
    });
    
    wholeWordToggle.addEventListener('click', () => {
        searchConfig.wholeWord = !searchConfig.wholeWord;
        updateToggleButtons();
        vscode.postMessage({ 
            command: 'updateConfig', 
            config: { 'whole-word': searchConfig.wholeWord } 
        });
        
        // Re-search with new configuration if there's a query
        if (searchInput.value.trim()) {
            vscode.postMessage({ command: 'search', query: searchInput.value });
        }
    });
    
    updateToggleButtons();
}

// Update toggle button visual states
function updateToggleButtons() {
    caseSensitiveToggle.classList.toggle('active', searchConfig.caseSensitive);
    wholeWordToggle.classList.toggle('active', searchConfig.wholeWord);
}

// Initialize with initial data (will be set by the HTML template)
if (typeof initialData !== 'undefined') {
    results = initialData.results || [];
    currentSearchQuery = initialData.searchQuery || '';
    workspacePath = initialData.workspacePath || '';
    searchConfig = initialData.searchConfig || searchConfig;
}

// Initialize search type from HTML global variable if available
if (typeof searchType !== 'undefined') {
    currentSearchType = searchType;
    maxResults = searchType === 'file' ? 100 : 1000;
}

// Load search history on initialization
loadSearchHistory();

// Load initial config and setup toggle buttons
initializeSearchConfig();

// Apply layout class based on maximizeOnSearch config
const container = document.getElementById('container');
if (typeof isVerticalLayout !== 'undefined' && isVerticalLayout) {
    container.classList.add('vertical-layout');
} else {
    container.classList.add('horizontal-layout');
}

updateDisplay();

searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    
    // Clear existing timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // For file searches, no debounce needed - they should be instant
    // For folder searches, use minimal debounce only for longer queries
    
    if (searchType === 'file' || query.length <= 2) {
        // Immediate search for file searches and short queries
        vscode.postMessage({ command: 'search', query: query });
        return;
    }
    
    // For folder searches with longer queries, use minimal 50ms debounce
    searchTimeout = setTimeout(() => {
        vscode.postMessage({ command: 'search', query: query });
    }, 50);
});

// History navigation functions
function navigateToPreviousHistory() {
    if (searchHistory.length === 0) return;
    
    // If we're at the beginning of history navigation and current input matches the most recent history
    if (historyIndex === -1 && searchInput.value.trim() === searchHistory[0]) {
        // Skip the first item (current search) and go to the second item if it exists
        if (searchHistory.length > 1) {
            historyIndex = 1;
            searchInput.value = searchHistory[historyIndex];
            searchInput.select();
            // Trigger search with the history item
            vscode.postMessage({ command: 'search', query: searchHistory[historyIndex] });
        }
    } else if (historyIndex < searchHistory.length - 1) {
        historyIndex++;
        searchInput.value = searchHistory[historyIndex];
        searchInput.select();
        // Trigger search with the history item
        vscode.postMessage({ command: 'search', query: searchHistory[historyIndex] });
    }
}

function navigateToNextHistory() {
    if (historyIndex > 1) {
        historyIndex--;
        searchInput.value = searchHistory[historyIndex];
        searchInput.select();
        // Trigger search with the history item
        vscode.postMessage({ command: 'search', query: searchHistory[historyIndex] });
    } else if (historyIndex === 1) {
        // Go back to the most recent search (index 0)
        historyIndex = 0;
        searchInput.value = searchHistory[historyIndex];
        searchInput.select();
        // Trigger search with the history item
        vscode.postMessage({ command: 'search', query: searchHistory[historyIndex] });
    } else if (historyIndex === 0) {
        historyIndex = -1;
        searchInput.value = '';
        searchInput.focus();
        // Clear search results when going to empty search
        vscode.postMessage({ command: 'search', query: '' });
    }
}

searchInput.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'Escape':
            e.preventDefault();
            vscode.postMessage({ command: 'cancel' });
            break;
        case 'Enter':
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                addToHistory(query);
                historyIndex = -1; // Reset history index
            }
            if (results.length > 0) {
                vscode.postMessage({ command: 'select', index: selectedIndex });
            }
            break;
        case 'ArrowDown':
            e.preventDefault();
            if (selectedIndex < results.length - 1) {
                selectedIndex++;
                // Auto-load more results if we're near the end
                if (selectedIndex >= displayedResults - 5 && displayedResults < results.length) {
                    displayedResults = Math.min(displayedResults + LOAD_MORE_BATCH_SIZE, results.length);
                }
                updateSelection();
            }
            break;
        case 'ArrowUp':
            e.preventDefault();
            if (selectedIndex > 0) {
                selectedIndex--;
                updateSelection();
            }
            break;
    }
});

window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'updateResults') {
        results = message.results;
        currentSearchQuery = message.searchQuery || '';
        workspacePath = message.workspacePath || '';
        currentSearchType = message.searchType || 'folder';
        maxResults = message.maxResults || 1000;
        selectedIndex = 0;
        displayedResults = INITIAL_BATCH_SIZE; // Reset to initial batch size
        updateDisplay();
    } else if (message.command === 'updateContext') {
        // Handle context update for a specific result
        const { index, context } = message;
        if (results[index]) {
            results[index].context = context;
            updateContext();
        }
    } else if (message.command === 'focus') {
        searchInput.focus();
    } else if (message.command === 'historyLoaded') {
        // Handle loaded search history
        searchHistory = message.history || [];
        historyIndex = -1;
        
        // Set the last search term in input if history exists
        if (searchHistory.length > 0 && !searchInput.value) {
            searchInput.value = searchHistory[0];
            searchInput.select();
            // Trigger search with the last history item
            vscode.postMessage({ command: 'search', query: searchHistory[0] });
        }
    } else if (message.command === 'historyPrevious') {
        navigateToPreviousHistory();
    } else if (message.command === 'historyNext') {
        navigateToNextHistory();
    } else if (message.command === 'configLoaded') {
        // Handle loaded search configuration
        const config = message.config || {};
        // Invert case-sensitive logic: UI shows case-insensitive button, config tracks case-sensitive
        searchConfig.caseSensitive = !(config['case-sensitive'] || false);
        searchConfig.wholeWord = config['whole-word'] || false;
        updateToggleButtons();
    } else if (message.command === 'historyCleared') {
        // Handle history clearing
        searchHistory = [];
        historyIndex = -1;
        // Clear the search input if it was showing a history item
        searchInput.value = '';
        searchInput.focus();
        // Clear search results
        vscode.postMessage({ command: 'search', query: '' });
    }
});

function loadMoreResults() {
    displayedResults = Math.min(displayedResults + LOAD_MORE_BATCH_SIZE, results.length);
    updateResultsList();
    updateResultCount();
}

function updateResultCount() {
    const total = results.length;
    const hitLimit = results.length >= maxResults;
    const suffix = hitLimit ? '+' : '';
    resultCount.textContent = `${total}${suffix} results`;
}

function updateDisplay() {
    updateResultsList();
    updateResultCount();
    updateContext();
}

function updateResultsList() {
    if (results.length === 0) {
        resultsList.innerHTML = '<div class="no-results">No results found</div>';
        return;
    }

    // Limit displayed results for performance
    const resultsToShow = Math.min(displayedResults, results.length);
    const hasMore = results.length > displayedResults;
    
    let html = results.slice(0, resultsToShow).map((result, index) => {
        const relativePath = getRelativePath(result.file, workspacePath);
        const highlightedText = highlightSearchTerm(escapeHtml(result.text), currentSearchQuery);
        
        // Extract filename and directory path
        const pathParts = relativePath.split('/');
        const filename = pathParts.pop();
        const dirPath = pathParts.length > 0 ? pathParts.join('/') + '/' : '';
        
        return `<div class="result-item ${index === selectedIndex ? 'selected' : ''}" 
                    onclick="navigateToResult(${index})">
            <div class="result-text">${highlightedText}</div>
            <div class="result-file">${dirPath}<span class="filename">${filename}</span> ${result.line}</div>
        </div>`;
    }).join('');

    // Add load more button if there are more results
    if (hasMore) {
        const remaining = results.length - displayedResults;
        html += `<div class="load-more-container">
            <button class="load-more-btn" onclick="loadMoreResults()">
                Load ${Math.min(LOAD_MORE_BATCH_SIZE, remaining)} more results (${remaining} remaining)
            </button>
        </div>`;
    }

    resultsList.innerHTML = html;
}

function updateContext() {
    if (results.length === 0 || !results[selectedIndex]) {
        contextPanel.innerHTML = '<div class="no-results">Select a result to see context</div>';
        return;
    }

    const result = results[selectedIndex];
    const context = result.context || [];
    const matchLine = result.text;

    // If context has only one line (the match line), it means context hasn't been loaded yet
    if (context.length === 1 && context[0] === matchLine.trim()) {
        contextPanel.innerHTML = '<div class="context-loading">Loading context...</div>';
        // Request context loading for this result (throttled to avoid spam)
        if (!result.contextRequested) {
            result.contextRequested = true;
            vscode.postMessage({ command: 'loadContext', index: selectedIndex });
        }
        return;
    }

    if (context.length === 0) {
        const highlightedLine = highlightSearchTerm(escapeHtml(matchLine), currentSearchQuery);
        contextPanel.innerHTML = `<div class="context-line context-match">${highlightedLine}</div>`;
        return;
    }

    let contextHtml = '';
    
    context.forEach((line, index) => {
        const isMatch = line.trim() === matchLine.trim();
        const highlightedLine = highlightSearchTerm(escapeHtml(line), currentSearchQuery);
        contextHtml += `<div class="context-line ${isMatch ? 'context-match' : ''}">${highlightedLine}</div>`;
    });

    contextPanel.innerHTML = contextHtml;
}

function selectResult(index) {
    selectedIndex = index;
    updateSelection();
}

function navigateToResult(index) {
    selectedIndex = index;
    updateSelection();
    vscode.postMessage({ command: 'select', index: index });
}

function updateSelection() {
    updateResultsList();
    updateContext();
    
    // Scroll selected item into view
    const selectedItem = document.querySelector('.result-item.selected');
    if (selectedItem) {
        selectedItem.scrollIntoView({ 
            behavior: 'instant', 
            block: 'nearest',
            inline: 'nearest'
        });
    }
}

function highlightSearchTerm(text, searchQuery) {
    if (!searchQuery || searchQuery.trim() === '') {
        return text;
    }
    
    try {
        // Try to use the search query as a regex
        const regex = new RegExp(searchQuery, 'gi');
        return text.replace(regex, function(match) {
            return '<span class="search-highlight">' + match + '</span>';
        });
    } catch (error) {
        // If regex fails, do a case-insensitive literal string search
        const lowerText = text.toLowerCase();
        const lowerQuery = searchQuery.toLowerCase();
        let result = '';
        let lastIndex = 0;
        let index = lowerText.indexOf(lowerQuery);
        
        while (index !== -1) {
            result += text.substring(lastIndex, index);
            result += '<span class="search-highlight">' + text.substring(index, index + searchQuery.length) + '</span>';
            lastIndex = index + searchQuery.length;
            index = lowerText.indexOf(lowerQuery, lastIndex);
        }
        result += text.substring(lastIndex);
        return result;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getRelativePath(fullPath, workspacePath) {
    if (!workspacePath || !fullPath) {
        // Fallback to just the filename if no workspace path
        return fullPath.split('/').pop() || fullPath.split('\\').pop() || fullPath;
    }
    
    // Normalize paths to use forward slashes
    const normalizedFullPath = fullPath.replace(/\\/g, '/');
    const normalizedWorkspacePath = workspacePath.replace(/\\/g, '/');
    
    // Ensure workspace path ends with slash for proper comparison
    const workspacePathWithSlash = normalizedWorkspacePath.endsWith('/') 
        ? normalizedWorkspacePath 
        : normalizedWorkspacePath + '/';
    
    if (normalizedFullPath.startsWith(workspacePathWithSlash)) {
        // Return relative path
        return normalizedFullPath.substring(workspacePathWithSlash.length);
    }
    
    // If not within workspace, return just the filename
    return normalizedFullPath.split('/').pop() || normalizedFullPath;
}
