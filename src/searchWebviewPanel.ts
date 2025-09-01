import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SearchResult } from './searchProvider';
import { RipgrepService } from './ripgrepService';

export class SearchWebviewPanel {
    private panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private filteredResults: SearchResult[] = [];
    private currentSearchQuery: string = '';

    constructor(
        private context: vscode.ExtensionContext,
        private initialResults: SearchResult[],
        private searchType: 'file' | 'folder',
        private onNavigate: (result: SearchResult) => void,
        private onCancel: () => void,
        private onSearch: (query: string) => Promise<SearchResult[]>,
        private onLoadContext: (result: SearchResult) => Promise<SearchResult>,
        private ripgrepService: RipgrepService,
        private searchPath?: string,
        private viewColumn?: vscode.ViewColumn
    ) {
        const getTitle = () => {
            if (searchType === 'file' && searchPath) {
                return `Regex Search - file - ${searchPath}`;
            }
            if (searchType === 'folder' && searchPath) {
                return `Regex Search - folder - ${searchPath}/`;
            }
            return `Regex Search - ${searchType === 'file' ? 'Current File' : 'Current Folder'}`;
        };

        this.panel = vscode.window.createWebviewPanel(
            'regexSearch',
            getTitle(),
            viewColumn || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.filteredResults = initialResults;
        this.panel.webview.html = this.getWebviewContent();
        this.setupEventHandlers();
        
        // Listen for configuration changes to update context panel height
        const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('regexSearch.contextSize')) {
                this.ripgrepService.refreshConfiguration();
                this.panel.webview.html = this.getWebviewContent(); // Reload webview with new height
            }
        });
        this.disposables.push(configChangeListener);
        
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

        // Focus the search input when the panel becomes active/visible
        this.panel.onDidChangeViewState(
            e => {
                if (e.webviewPanel.active) {
                    // Small delay to ensure the webview is fully rendered
                    setTimeout(() => {
                        this.panel.webview.postMessage({ command: 'focus' });
                    }, 50);
                }
            },
            null,
            this.disposables
        );

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

    private async handleLoadContext(index: number) {
        try {
            if (index >= 0 && index < this.filteredResults.length) {
                const result = this.filteredResults[index];
                const resultWithContext = await this.onLoadContext(result);
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

    private handleSelect(index: number) {
        if (index >= 0 && index < this.filteredResults.length) {
            const result = this.filteredResults[index];
            this.onNavigate(result);
        }
    }

    private handleCancel() {
        this.onCancel();
    }

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

    private calculateContextPanelHeight(): number {
        const contextSize = this.ripgrepService.getContextSize();
        // Base height (padding, borders, etc.) + lines
        // Each context line is approximately 16px (12px font + 2px margin)
        // Add some extra padding for better UX
        const baseHeight = 40; // Padding and borders
        const lineHeight = 16; // Approximate height per line
        const maxLines = Math.max(contextSize * 2 + 1, 3); // context before + match + context after, minimum 3 lines
        return Math.min(Math.max(baseHeight + (maxLines * lineHeight), 80), 300); // Min 80px, max 300px
    }

    private getWebviewContent(): string {
        // Get URIs for the webview resources
        const htmlPath = path.join(this.context.extensionPath, 'src', 'webview', 'search.html');
        const cssPath = path.join(this.context.extensionPath, 'src', 'webview', 'search.css');
        const jsPath = path.join(this.context.extensionPath, 'src', 'webview', 'search.js');

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

        // Replace placeholders in the HTML template
        htmlContent = htmlContent
            .replace('{{cssUri}}', cssUri.toString())
            .replace('{{jsUri}}', jsUri.toString())
            .replace('{{initialData}}', JSON.stringify(initialData))
            .replace('{{searchType}}', this.searchType)
            .replace('{{contextPanelHeight}}', contextPanelHeight.toString());

        return htmlContent;
    }
}