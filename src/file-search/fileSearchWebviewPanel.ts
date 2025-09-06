/**
 * Webview panel for displaying and managing file search results.
 * Provides UI for fuzzy file searching and navigation with file previews.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileSearchService, FileSearchResult } from './fileSearchService';

/**
 * Manages the webview panel for file search with fuzzy matching.
 */
export class FileSearchWebviewPanel {
    private panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private filteredResults: FileSearchResult[] = [];
    private currentSearchQuery: string = '';
    private isInitialized: boolean = false;
    private wasMaximized: boolean = false;

    /**
     * Creates a new file search webview panel.
     */
    constructor(
        private context: vscode.ExtensionContext,
        private initialResults: FileSearchResult[],
        private onNavigate: (result: FileSearchResult) => void,
        private onCancel: () => void,
        private onSearch: (query: string) => Promise<FileSearchResult[]>,
        private onLoadContext: (result: FileSearchResult, isVerticalLayout: boolean) => Promise<string[]>,
        private searchService: FileSearchService,
        private searchPath?: string,
        private viewColumn?: vscode.ViewColumn
    ) {
        const getTitle = () => {
            if (searchPath) {
                return `File Search in ${searchPath}`;
            }
            return 'File Search';
        };

        this.panel = vscode.window.createWebviewPanel(
            'fileSearch',
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
        
        // Listen for configuration changes
        const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('quickFind.maxResults') || event.affectsConfiguration('quickFind.accentColor')) {
                this.searchService.refreshConfiguration();
                if (event.affectsConfiguration('quickFind.accentColor')) {
                    this.panel.webview.html = this.getWebviewContent(); // Reload webview with new accent color
                }
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
        
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Sets up event handlers for webview interactions.
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
                }
            },
            null,
            this.disposables
        );
    }

    /**
     * Handles file search requests from webview.
     * @param query - File search query for fuzzy matching
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
     * Loads context preview for a file result.
     * @param index - Index of the file result to load context for
     */
    private async handleLoadContext(index: number) {
        try {
            if (index >= 0 && index < this.filteredResults.length) {
                const result = this.filteredResults[index];
                // Determine layout mode from configuration
                const config = vscode.workspace.getConfiguration('quickFind');
                const isVerticalLayout = config.get<boolean>('maximizedLayout', false);
                
                const context = await this.onLoadContext(result, isVerticalLayout);
                this.panel.webview.postMessage({
                    command: 'updateContext',
                    index: index,
                    context: context
                });
            }
        } catch (error) {
            console.error('Context loading error:', error);
        }
    }

    /**
     * Handles selection of a file result.
     * @param index - Index of the selected file result
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
            workspacePath: workspacePath
        });
    }

    /**
     * Generates HTML content for the file search webview.
     */
    private getWebviewContent(): string {
        // Get URIs for the webview resources
        const htmlPath = path.join(this.context.extensionPath, 'src', 'file-search', 'file-search-webview', 'fileSearch.html');
        const cssPath = path.join(this.context.extensionPath, 'src', 'file-search', 'file-search-webview', 'fileSearch.css');
        const jsPath = path.join(this.context.extensionPath, 'src', 'file-search', 'file-search-webview', 'fileSearch.js');

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
            workspacePath: workspacePath
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
            .replace('{{contextPanelHeight}}', contextPanelHeight.toString())
            .replace('{{accentColor}}', accentColor)
            .replace('{{isVerticalLayout}}', isVerticalLayout.toString());

        return htmlContent;
    }

    /**
     * Calculates optimal height for file preview panel.
     */
    private calculateContextPanelHeight(): number {
        // For horizontal layout (fixed height), use horizontal context size
        const contextSize = this.searchService.getContextSize(false); // Always use horizontal for height calculation
        // Base height (padding, borders, etc.) + lines
        // Each context line is approximately 16.8px (12px font * 1.4 line-height)
        // For file-search, we show contextSize * 3 lines
        const baseHeight = 40; // Padding and borders
        const lineHeight = 16.8; // 12px font-size * 1.4 line-height
        const maxLines = contextSize * 3; // Using the CONTEXT_MULTIPLIER
        
        // Calculate desired height based on content
        const desiredHeight = baseHeight + (maxLines * lineHeight);
        
        // Calculate 50% of screen height (assuming typical screen height of 1080px)
        // In VSCode webview, we can't directly get screen dimensions, so we use a reasonable estimate
        const maxScreenHeightPercent = Math.floor(1080 * 0.5); // 50% of typical screen height
        
        // Return height: minimum 80px, maximum 50% of screen or desired height, whichever is smaller
        return Math.min(Math.max(desiredHeight, 80), maxScreenHeightPercent);
    }
}