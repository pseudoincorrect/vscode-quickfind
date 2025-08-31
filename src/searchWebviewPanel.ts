import * as vscode from 'vscode';
import { SearchResult } from './fuzzySearchProvider';
import { FuzzyMatcher, FuzzyMatch } from './fuzzyMatcher';

export class SearchWebviewPanel {
    private panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private filteredResults: FuzzyMatch[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private initialResults: SearchResult[],
        private searchType: 'file' | 'folder',
        private fuzzyMatcher: FuzzyMatcher,
        private onNavigate: (result: SearchResult) => void,
        private onCancel: () => void
    ) {
        this.panel = vscode.window.createWebviewPanel(
            'fuzzySearch',
            `Fuzzy Search - ${searchType === 'file' ? 'Current File' : 'Current Folder'}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.filteredResults = this.fuzzyMatcher.fuzzyFilter(initialResults, '');
        this.panel.webview.html = this.getWebviewContent();
        this.setupEventHandlers();
        
        // Focus the search input after a brief delay
        setTimeout(() => {
            this.panel.webview.postMessage({ command: 'focus' });
        }, 100);
    }

    dispose() {
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private setupEventHandlers() {
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'search':
                        this.handleSearch(message.query);
                        break;
                    case 'select':
                        this.handleSelect(message.index);
                        break;
                    case 'cancel':
                        this.handleCancel();
                        break;
                }
            },
            null,
            this.disposables
        );
    }

    private handleSearch(query: string) {
        this.filteredResults = this.fuzzyMatcher.fuzzyFilter(this.initialResults, query);
        this.updateResults();
    }

    private handleSelect(index: number) {
        if (index >= 0 && index < this.filteredResults.length) {
            const result = this.filteredResults[index].result;
            this.onNavigate(result);
        }
    }

    private handleCancel() {
        this.onCancel();
    }

    private updateResults() {
        this.panel.webview.postMessage({
            command: 'updateResults',
            results: this.filteredResults
        });
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
        .container { display: flex; flex-direction: column; height: 100vh; }
        .search-box { padding: 10px; border-bottom: 1px solid var(--vscode-panel-border); }
        .search-input { width: 100%; padding: 8px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); font-size: 14px; }
        .results-container { flex: 1; display: flex; flex-direction: column; }
        .results-list { flex: 1; overflow-y: auto; border-bottom: 1px solid var(--vscode-panel-border); }
        .result-item { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--vscode-panel-border); }
        .result-item:hover, .result-item.selected { background: var(--vscode-list-hoverBackground); }
        .result-file { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 2px; }
        .result-text { font-size: 14px; font-family: var(--vscode-editor-font-family); }
        .highlight { background: var(--vscode-editor-findMatchBackground); color: var(--vscode-editor-findMatchForeground); }
        .context-panel { flex: 1; padding: 10px; overflow-y: auto; background: var(--vscode-editor-background); }
        .context-line { font-family: var(--vscode-editor-font-family); font-size: 13px; margin: 2px 0; white-space: pre-wrap; }
        .context-match { background: var(--vscode-editor-findMatchBackground); font-weight: bold; }
        .no-results { padding: 20px; text-align: center; color: var(--vscode-descriptionForeground); }
        .keybinds { position: absolute; bottom: 10px; right: 10px; font-size: 11px; color: var(--vscode-descriptionForeground); }
    </style>
</head>
<body>
    <div class="container">
        <div class="search-box">
            <input type="text" class="search-input" placeholder="Type to search..." autofocus>
        </div>
        <div class="results-container">
            <div class="results-list" id="resultsList"></div>
            <div class="context-panel" id="contextPanel">
                <div class="no-results">Select a result to see context</div>
            </div>
        </div>
        <div class="keybinds">ESC: Cancel | Enter: Navigate | ↑↓: Navigate</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let results = [];
        let selectedIndex = 0;

        const searchInput = document.querySelector('.search-input');
        const resultsList = document.getElementById('resultsList');
        const contextPanel = document.getElementById('contextPanel');

        // Initialize with all results
        results = ${JSON.stringify(this.filteredResults)};
        updateDisplay();

        searchInput.addEventListener('input', (e) => {
            vscode.postMessage({ command: 'search', query: e.target.value });
        });

        searchInput.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    vscode.postMessage({ command: 'cancel' });
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (results.length > 0) {
                        vscode.postMessage({ command: 'select', index: selectedIndex });
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (selectedIndex < results.length - 1) {
                        selectedIndex++;
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
                selectedIndex = 0;
                updateDisplay();
            } else if (message.command === 'focus') {
                searchInput.focus();
            }
        });

        function updateDisplay() {
            updateResultsList();
            updateContext();
        }

        function updateResultsList() {
            if (results.length === 0) {
                resultsList.innerHTML = '<div class="no-results">No results found</div>';
                return;
            }

            resultsList.innerHTML = results.map((match, index) => {
                const result = match.result;
                const fileName = result.file.split('/').pop();
                const relativePath = result.file.replace(/^.*\\//, '');
                
                return \`<div class="result-item \${index === selectedIndex ? 'selected' : ''}" 
                            onclick="selectResult(\${index})">
                    <div class="result-file">\${relativePath}:\${result.line}:\${result.column}</div>
                    <div class="result-text">\${highlightText(result.text, match.matchedIndices)}</div>
                </div>\`;
            }).join('');
        }

        function updateContext() {
            if (results.length === 0 || !results[selectedIndex]) {
                contextPanel.innerHTML = '<div class="no-results">Select a result to see context</div>';
                return;
            }

            const result = results[selectedIndex].result;
            const context = result.context || [];
            const matchLine = result.text;

            if (context.length === 0) {
                contextPanel.innerHTML = \`<div class="context-line context-match">\${matchLine}</div>\`;
                return;
            }

            let contextHtml = '';
            const midPoint = Math.floor(context.length / 2);
            
            context.forEach((line, index) => {
                const isMatch = line.trim() === matchLine.trim();
                contextHtml += \`<div class="context-line \${isMatch ? 'context-match' : ''}">\${escapeHtml(line)}</div>\`;
            });

            contextPanel.innerHTML = contextHtml;
        }

        function selectResult(index) {
            selectedIndex = index;
            updateSelection();
        }

        function updateSelection() {
            updateResultsList();
            updateContext();
            
            // Scroll selected item into view
            const selectedItem = document.querySelector('.result-item.selected');
            if (selectedItem) {
                selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        function highlightText(text, matchedIndices) {
            if (!matchedIndices || matchedIndices.length === 0) {
                return escapeHtml(text);
            }

            let result = '';
            let lastIndex = 0;

            matchedIndices.forEach(index => {
                if (index >= text.length) return;
                result += escapeHtml(text.substring(lastIndex, index));
                result += \`<span class="highlight">\${escapeHtml(text[index])}</span>\`;
                lastIndex = index + 1;
            });

            result += escapeHtml(text.substring(lastIndex));
            return result;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
    }
}