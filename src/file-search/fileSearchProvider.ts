/**
 * Provider for file search functionality with fuzzy matching and file navigation.
 * Manages webview panels and search operations for finding files by name.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FileSearchService, FileSearchResult } from './fileSearchService';
import { FileSearchWebviewPanel } from './fileSearchWebviewPanel';

/**
 * Provides file search functionality with fuzzy matching.
 */
export class FileSearchProvider {
    private searchService: FileSearchService;
    private currentWebviewPanel: FileSearchWebviewPanel | undefined;
    private originalEditor: vscode.TextEditor | undefined;
    private initialResults: FileSearchResult[] = [];
    private currentSearchPath: string | undefined;

    /**
     * Creates a new FileSearchProvider instance.
     * @param context - VSCode extension context for subscriptions and resources
     */
    constructor(private context: vscode.ExtensionContext) {
        this.searchService = new FileSearchService();
        
        // Listen for configuration changes
        const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('quickFind.maxResults')) {
                this.searchService.refreshConfiguration();
            }
        });
        this.context.subscriptions.push(configChangeListener);
    }

    /**
     * Initiates file search within the current workspace.
     */
    async searchFiles() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        this.originalEditor = vscode.window.activeTextEditor;
        this.currentSearchPath = workspaceFolder.uri.fsPath;
        
        try {
            // Load initial files (empty query shows all files)
            const initialResults = await this.searchService.searchFiles(this.currentSearchPath, '');
            this.showSearchWebview(initialResults);
        } catch (error) {
            vscode.window.showErrorMessage(`Error searching files: ${error}`);
        }
    }

    /**
     * Shows the file search webview panel with initial results.
     * @param results - Initial search results to display
     */
    private showSearchWebview(results: FileSearchResult[]) {
        if (this.currentWebviewPanel) {
            this.currentWebviewPanel.dispose();
        }

        // Get the current editor's view column, default to ViewColumn.One if no editor is active
        const currentViewColumn = this.originalEditor?.viewColumn || vscode.ViewColumn.One;

        this.currentWebviewPanel = new FileSearchWebviewPanel(
            this.context,
            results,
            (result: FileSearchResult) => this.navigateToResult(result),
            () => this.returnToOriginalEditor(),
            (query: string) => this.performSearch(query),
            (result: FileSearchResult) => this.loadContextForResult(result),
            this.searchService,
            this.currentSearchPath,
            currentViewColumn
        );
    }

    /**
     * Performs the actual file search operation.
     * @param query - Search query for fuzzy file matching
     */
    private async performSearch(query: string): Promise<FileSearchResult[]> {
        if (!this.currentSearchPath) {
            return [];
        }

        try {
            return await this.searchService.searchFiles(this.currentSearchPath, query);
        } catch (error) {
            console.error('File search error:', error);
            return [];
        }
    }

    /**
     * Loads file context (directory listing or file preview).
     * @param result - File search result to load context for
     */
    private async loadContextForResult(result: FileSearchResult): Promise<string[]> {
        const config = vscode.workspace.getConfiguration('quickFind');
        const contextSize = config.get<number>('contextSize', 5);
        return await this.searchService.getFileContext(result.file, contextSize);
    }

    /**
     * Navigates to a selected file result.
     * @param result - File search result to navigate to
     */
    private async navigateToResult(result: FileSearchResult) {
        try {
            // First, dispose the webview panel to ensure focus returns to the editor
            if (this.currentWebviewPanel) {
                this.currentWebviewPanel.dispose();
                this.currentWebviewPanel = undefined;
            }

            if (result.isDirectory) {
                // Open the directory in Explorer
                await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(result.file));
            } else {
                // Open the file in the same view column as the original editor
                const document = await vscode.workspace.openTextDocument(result.file);
                const targetViewColumn = this.originalEditor?.viewColumn || vscode.ViewColumn.One;
                const editor = await vscode.window.showTextDocument(document, targetViewColumn);
                
                // Focus on the first line of the file
                const position = new vscode.Position(0, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            }
            
            // Reset the search path
            this.currentSearchPath = undefined;
        } catch (error) {
            vscode.window.showErrorMessage(`Error opening file: ${error}`);
        }
    }

    /**
     * Returns focus to the original editor and closes webview.
     */
    private returnToOriginalEditor() {
        if (this.originalEditor) {
            vscode.window.showTextDocument(this.originalEditor.document);
        }
        
        if (this.currentWebviewPanel) {
            this.currentWebviewPanel.dispose();
            this.currentWebviewPanel = undefined;
        }
        
        // Reset the search path
        this.currentSearchPath = undefined;
    }
}