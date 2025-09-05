const vscode = acquireVsCodeApi();
let results = [];
let selectedIndex = 0;
let searchTimeout = null;
let currentSearchQuery = '';
let workspacePath = '';
let displayedResults = 50; // Initially show only 50 results
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

// Initialize with initial data (will be set by the HTML template)
if (typeof initialData !== 'undefined') {
    results = initialData.results || [];
    currentSearchQuery = initialData.searchQuery || '';
    workspacePath = initialData.workspacePath || '';
}

// Load search history on initialization
loadSearchHistory();

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
    if (searchHistory.length > 0 && historyIndex < searchHistory.length - 1) {
        historyIndex++;
        searchInput.value = searchHistory[historyIndex];
        searchInput.select();
    }
}

function navigateToNextHistory() {
    if (historyIndex > 0) {
        historyIndex--;
        searchInput.value = searchHistory[historyIndex];
        searchInput.select();
    } else if (historyIndex === 0) {
        historyIndex = -1;
        searchInput.value = '';
        searchInput.focus();
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
        }
    } else if (message.command === 'historyPrevious') {
        navigateToPreviousHistory();
    } else if (message.command === 'historyNext') {
        navigateToNextHistory();
    }
});

function loadMoreResults() {
    displayedResults = Math.min(displayedResults + LOAD_MORE_BATCH_SIZE, results.length);
    updateResultsList();
}

function updateDisplay() {
    updateResultsList();
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
