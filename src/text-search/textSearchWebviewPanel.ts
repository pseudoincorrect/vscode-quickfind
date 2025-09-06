/**
 * Webview panel for displaying and managing text search results.
 * Handles the UI, user interactions, and communication between webview and extension.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SearchService, SearchResult } from './textSearchService';
import { setActiveQuickFindPanel } from '../extension';

/**
 * Manages the webview panel for text search with results display and navigation.
 */
export class SearchWebviewPanel {
    private panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private filteredResults: SearchResult[] = [];
    private currentSearchQuery: string = '';
    private isInitialized: boolean = false;
    private wasMaximized: boolean = false;

    /**
     * Creates a new search webview panel with specified configuration.
     */
    constructor(
        private context: vscode.ExtensionContext,
        private initialResults: SearchResult[],
        private searchType: 'file' | 'folder',
        private onNavigate: (result: SearchResult) => void,
        private onCancel: () => void,
        private onSearch: (query: string) => Promise<SearchResult[]>,
        private onLoadContext: (result: SearchResult, isVerticalLayout: boolean) => Promise<SearchResult>,
        private searchService: SearchService,
        private searchPath?: string,
        private viewColumn?: vscode.ViewColumn
    ) {
        const getTitle = () => {
            if (searchType === 'file' && searchPath) {
                return `Text Search in ${searchPath}`;
            }
            if (searchType === 'folder' && searchPath) {
                return `Text Search in ${searchPath}/`;
            }
            return `Text Search in ${searchType === 'file' ? 'Current File' : 'Current Folder'}`;
        };

        this.panel = vscode.window.createWebviewPanel(
            'quickFind',
            getTitle(),
            viewColumn || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Maximize immediately before setting up the webview for faster response
        this.maximizeIfNeeded();
        
        this.filteredResults = initialResults;
        this.panel.webview.html = this.getWebviewContent();
        this.setupEventHandlers();
        
        // Register this panel as the active QuickFind panel
        setActiveQuickFindPanel(this.panel);
        
        // Listen for configuration changes to update accent color
        const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('quickFind.accentColor')) {
                this.searchService.refreshConfiguration();
                this.panel.webview.html = this.getWebviewContent(); // Reload webview with new settings
            }
        });
        this.disposables.push(configChangeListener);
        
        // Focus the search input after a brief delay and mark as initialized
        setTimeout(() => {
            this.panel.webview.postMessage({ command: 'focus' });
            this.isInitialized = true;
        }, 200);
    }

    /**
     * Disposes the panel and cleans up resources.
     */
    dispose() {
        // Restore layout before disposing if we maximized it
        this.restoreLayoutIfNeeded();
        
        // Unregister this panel as the active QuickFind panel
        setActiveQuickFindPanel(null);
        
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Sets up event handlers for webview and VSCode interactions.
     */
    private setupEventHandlers() {
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Focus the search input when the panel becomes active/visible
        this.panel.onDidChangeViewState(
            e => {
                if (e.webviewPanel.active) {
                    // Small delay to ensure the webview is fully rendered
                    setTimeout(() => {
                        this.panel.webview.postMessage({ command: 'focus' });
                    }, 50);
                } else if (e.webviewPanel.visible && !e.webviewPanel.active && this.isInitialized) {
                    // Panel is visible but not active (lost focus) - close it
                    // Only close if the panel has been fully initialized to avoid closing during startup
                    this.handleCancel();
                }
            },
            null,
            this.disposables
        );

        // Listen for active text editor changes (switching files via shortcuts like Ctrl+Tab)
        const activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
            // Only close if the panel is still active and visible and has been initialized
            // This ensures we close when user switches files via shortcuts
            if (this.panel.active && this.panel.visible && this.isInitialized) {
                this.handleCancel();
            }
        });
        this.disposables.push(activeEditorChangeListener);

        // Listen for window focus changes (clicking on other views like Explorer, Terminal, etc.)
        const windowStateChangeListener = vscode.window.onDidChangeWindowState(state => {
            if (!state.focused && this.isInitialized) {
                // VS Code window lost focus entirely - close the panel
                // Only close if the panel has been fully initialized
                this.handleCancel();
            }
        });
        this.disposables.push(windowStateChangeListener);

        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'search':
                        this.handleSearch(message.query);
                        break;
                    case 'select':
                        this.handleSelect(message.index);
                        break;
                    case 'loadContext':
                        this.handleLoadContext(message.index);
                        break;
                    case 'cancel':
                        this.handleCancel();
                        break;
                    case 'loadHistory':
                        this.handleLoadHistory(message.file);
                        break;
                    case 'saveHistory':
                        this.handleSaveHistory(message.file, message.history);
                        break;
                    case 'historyPrevious':
                        this.panel.webview.postMessage({ command: 'historyPrevious' });
                        break;
                    case 'historyNext':
                        this.panel.webview.postMessage({ command: 'historyNext' });
                        break;
                    case 'loadConfig':
                        this.handleLoadConfig();
                        break;
                    case 'updateConfig':
                        this.handleUpdateConfig(message.config);
                        break;
                    case 'clearHistory':
                        this.handleClearHistory();
                        break;
                }
            },
            null,
            this.disposables
        );
    }

    /**
     * Handles search requests from the webview.
     * @param query - Search query/pattern from the webview input
     */
    private async handleSearch(query: string) {
        try {
            this.currentSearchQuery = query;
            const searchResults = await this.onSearch(query);
            this.filteredResults = searchResults;
            this.updateResults();
        } catch (error) {
            console.error('Search error:', error);
            this.filteredResults = [];
            this.updateResults();
        }
    }

    /**
     * Loads additional context for a specific search result.
     * @param index - Index of the result in the filtered results array
     */
    private async handleLoadContext(index: number) {
        try {
            if (index >= 0 && index < this.filteredResults.length) {
                const result = this.filteredResults[index];
                // Determine layout mode from configuration
                const config = vscode.workspace.getConfiguration('quickFind');
                const isVerticalLayout = config.get<boolean>('maximizedLayout', false);
                
                const resultWithContext = await this.onLoadContext(result, isVerticalLayout);
                this.filteredResults[index] = resultWithContext;
                this.panel.webview.postMessage({
                    command: 'updateContext',
                    index: index,
                    context: resultWithContext.context
                });
            }
        } catch (error) {
            console.error('Context loading error:', error);
        }
    }

    /**
     * Handles selection of a search result.
     * @param index - Index of the selected result
     */
    private async handleSelect(index: number) {
        if (index >= 0 && index < this.filteredResults.length) {
            const result = this.filteredResults[index];
            // Restore layout before navigating to maintain original split configuration
            await this.restoreLayoutIfNeeded();
            this.onNavigate(result);
        }
    }

    /**
     * Handles panel cancellation.
     */
    private async handleCancel() {
        // Restore layout before closing if we maximized it
        await this.restoreLayoutIfNeeded();
        this.onCancel();
    }

    /**
     * Maximizes the editor group if there are multiple groups visible and config allows it.
     */
    private async maximizeIfNeeded() {
        try {
            // Check if maximization is enabled in configuration
            const config = vscode.workspace.getConfiguration('quickFind');
            const shouldMaximize = config.get<boolean>('maximizedLayout', false);
            
            if (!shouldMaximize) {
                return;
            }
            
            // Check if we can maximize (only if there are multiple editor groups)
            const editorGroups = vscode.window.tabGroups.all;
            if (editorGroups.length > 1) {
                this.wasMaximized = true;
                await vscode.commands.executeCommand('workbench.action.toggleMaximizeEditorGroup');
            }
        } catch (error) {
            // Silently fail if the command is not available or fails
            console.debug('Could not maximize editor group:', error);
        }
    }

    /**
     * Restores the layout if we previously maximized it.
     */
    private async restoreLayoutIfNeeded() {
        try {
            if (this.wasMaximized) {
                await vscode.commands.executeCommand('workbench.action.toggleMaximizeEditorGroup');
                this.wasMaximized = false;
            }
        } catch (error) {
            // Silently fail if the command is not available or fails
            console.debug('Could not restore editor group:', error);
        }
    }

    /**
     * Loads search history from file.
     * @param filePath - Path to the history file to load
     */
    private async handleLoadHistory(filePath: string) {
        try {
            if (fs.existsSync(filePath)) {
                const historyData = fs.readFileSync(filePath, 'utf8');
                const history = JSON.parse(historyData);
                this.panel.webview.postMessage({
                    command: 'historyLoaded',
                    history: Array.isArray(history) ? history : []
                });
            } else {
                // File doesn't exist, return empty history
                this.panel.webview.postMessage({
                    command: 'historyLoaded',
                    history: []
                });
            }
        } catch (error) {
            console.error('Error loading search history:', error);
            this.panel.webview.postMessage({
                command: 'historyLoaded',
                history: []
            });
        }
    }

    /**
     * Saves search history to file.
     * @param filePath - Path to save the history file
     * @param history - Array of search history strings
     */
    private async handleSaveHistory(filePath: string, history: string[]) {
        try {
            // Ensure the directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving search history:', error);
        }
    }

    /**
     * Loads current search configuration.
     */
    private async handleLoadConfig() {
        try {
            const config = this.searchService.getSearchConfig();
            this.panel.webview.postMessage({
                command: 'configLoaded',
                config: config
            });
        } catch (error) {
            console.error('Error loading search config:', error);
        }
    }

    /**
     * Updates search configuration.
     * @param configUpdates - Configuration updates from webview
     */
    private async handleUpdateConfig(configUpdates: any) {
        try {
            this.searchService.updateSearchConfig(configUpdates);
        } catch (error) {
            console.error('Error updating search config:', error);
        }
    }

    /**
     * Clears search history.
     */
    private async handleClearHistory() {
        try {
            const HISTORY_FILE = '/tmp/vscode-quickfind-text-search-history.json';
            // Clear the history by writing an empty array
            await this.handleSaveHistory(HISTORY_FILE, []);
            // Notify the webview to clear its local history
            this.panel.webview.postMessage({
                command: 'historyCleared'
            });
        } catch (error) {
            console.error('Error clearing search history:', error);
        }
    }

    /**
     * Updates the webview with current search results.
     */
    private updateResults() {
        // Get workspace folder for relative path calculation
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;

        this.panel.webview.postMessage({
            command: 'updateResults',
            results: this.filteredResults,
            searchQuery: this.currentSearchQuery,
            workspacePath: workspacePath,
            searchType: this.searchType,
            maxResults: this.searchType === 'file' ? 100 : 1000
        });
    }

    /**
     * Calculates optimal height for context panel based on layout mode.
     */
    private calculateContextPanelHeight(): number {
        // For horizontal layout (fixed height), use horizontal context size
        const contextSize = this.searchService.getContextSize(false); // Always use horizontal for height calculation
        // Base height (padding, borders, etc.) + lines
        // Each context line is approximately 16px (12px font + 2px margin)
        // Add some extra padding for better UX
        const baseHeight = 40; // Padding and borders
        const lineHeight = 16; // Approximate height per line
        const maxLines = Math.max(contextSize * 2 + 1, 3); // context before + match + context after, minimum 3 lines
        
        // Calculate desired height based on content
        const desiredHeight = baseHeight + (maxLines * lineHeight);
        
        // Calculate 50% of screen height (assuming typical screen height of 1080px)
        // In VSCode webview, we can't directly get screen dimensions, so we use a reasonable estimate
        const maxScreenHeightPercent = Math.floor(1080 * 0.5); // 50% of typical screen height
        
        // Return height: minimum 80px, maximum 50% of screen or desired height, whichever is smaller
        return Math.min(Math.max(desiredHeight, 80), maxScreenHeightPercent);
    }

    /**
     * Generates the HTML content for the webview.
     */
    private getWebviewContent(): string {
        // Get URIs for the webview resources
        const htmlPath = path.join(this.context.extensionPath, 'src', 'text-search', 'text-search-webview', 'textSearch.html');
        const cssPath = path.join(this.context.extensionPath, 'src', 'text-search', 'text-search-webview', 'textSearch.css');
        const jsPath = path.join(this.context.extensionPath, 'src', 'text-search', 'text-search-webview', 'textSearch.js');

        // Convert paths to webview URIs
        const cssUri = this.panel.webview.asWebviewUri(vscode.Uri.file(cssPath));
        const jsUri = this.panel.webview.asWebviewUri(vscode.Uri.file(jsPath));

        // Read the HTML template
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');

        // Get workspace folder for relative path calculation
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;

        // Prepare initial data for injection
        const initialData = {
            results: this.filteredResults,
            searchQuery: this.currentSearchQuery,
            workspacePath: workspacePath,
            searchConfig: {
                caseSensitive: this.searchService.getSearchConfig()['case-sensitive'],
                wholeWord: this.searchService.getSearchConfig()['whole-word']
            }
        };

        // Calculate dynamic context panel height
        const contextPanelHeight = this.calculateContextPanelHeight();
        
        // Get configuration values
        const config = vscode.workspace.getConfiguration('quickFind');
        const accentColor = config.get<string>('accentColor') || '#00ff88';
        const isVerticalLayout = config.get<boolean>('maximizedLayout', false);

        // Replace placeholders in the HTML template
        htmlContent = htmlContent
            .replace('{{cssUri}}', cssUri.toString())
            .replace('{{jsUri}}', jsUri.toString())
            .replace('{{initialData}}', JSON.stringify(initialData))
            .replace('{{searchType}}', this.searchType)
            .replace('{{contextPanelHeight}}', contextPanelHeight.toString())
            .replace('{{accentColor}}', accentColor)
            .replace('{{isVerticalLayout}}', isVerticalLayout.toString());

        return htmlContent;
    }
}