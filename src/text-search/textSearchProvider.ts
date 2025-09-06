/**
 * Main provider for text search functionality within files and folders.
 * Manages webview panels, search operations, and navigation to results.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SearchService, SearchResult } from './textSearchService';
import { SearchWebviewPanel } from './textSearchWebviewPanel';

/**
 * Provides text search functionality with regex support.
 */
export class RegexSearchProvider {
    private searchService: SearchService;
    private currentWebviewPanel: SearchWebviewPanel | undefined;
    private originalEditor: vscode.TextEditor | undefined;
    private initialResults: SearchResult[] = [];
    private currentSearchPath: string | undefined;

    /**
     * Creates a new RegexSearchProvider instance.
     * @param context - VSCode extension context for subscriptions and resources
     */
    constructor(private context: vscode.ExtensionContext) {
        this.searchService = new SearchService();
        
    }

    /**
     * Initiates search within the currently active file.
     */
    async searchInCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        this.originalEditor = editor;
        this.currentSearchPath = editor.document.fileName;
        
        try {
            this.showSearchWebview([], 'file');
        } catch (error) {
            vscode.window.showErrorMessage(`Error searching in file: ${error}`);
        }
    }

    /**
     * Initiates search within the current workspace folder.
     */
    async searchInCurrentFolder() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        this.originalEditor = vscode.window.activeTextEditor;
        this.currentSearchPath = workspaceFolder.uri.fsPath;
        
        try {
            this.showSearchWebview([], 'folder');
        } catch (error) {
            vscode.window.showErrorMessage(`Error searching in folder: ${error}`);
        }
    }

    /**
     * Shows the search webview panel with initial results.
     * @param results - Initial search results to display
     * @param searchType - Whether searching in 'file' or 'folder'
     */
    private showSearchWebview(results: SearchResult[], searchType: 'file' | 'folder') {
        if (this.currentWebviewPanel) {
            this.currentWebviewPanel.dispose();
        }

        // Get the current editor's view column, default to ViewColumn.One if no editor is active
        const currentViewColumn = this.originalEditor?.viewColumn || vscode.ViewColumn.One;

        this.currentWebviewPanel = new SearchWebviewPanel(
            this.context,
            results,
            searchType,
            (result: SearchResult) => this.navigateToResult(result),
            () => this.returnToOriginalEditor(),
            (query: string) => this.performSearch(query, searchType),
            (result: SearchResult, isVerticalLayout: boolean) => this.loadContextForResult(result, isVerticalLayout), // Add context loading callback
            this.searchService,
            this.currentSearchPath,
            currentViewColumn
        );
    }

    /**
     * Performs the actual search operation based on query and type.
     * @param query - Search pattern/regex to match
     * @param searchType - Whether searching in 'file' or 'folder'
     */
    private async performSearch(query: string, searchType: 'file' | 'folder'): Promise<SearchResult[]> {
        if (!query.trim()) {
            return this.initialResults;
        }

        try {
            if (searchType === 'file') {
                if (!this.currentSearchPath) {
                    return [];
                }
                return await this.searchService.searchWithQuery(this.currentSearchPath, query, true);
            } else {
                if (!this.currentSearchPath) {
                    return [];
                }
                return await this.searchService.searchWithQuery(this.currentSearchPath, query, false);
            }
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    /**
     * Loads additional context lines around a search result.
     * @param result - Search result to load context for
     * @param isVerticalLayout - Whether using vertical layout (affects context size)
     */
    private async loadContextForResult(result: SearchResult, isVerticalLayout: boolean): Promise<SearchResult> {
        return await this.searchService.loadContextForResult(result, isVerticalLayout);
    }

    /**
     * Navigates to a specific search result in the editor.
     * @param result - Search result to navigate to
     */
    private async navigateToResult(result: SearchResult) {
        try {
            // First, dispose the webview panel to ensure focus returns to the editor
            if (this.currentWebviewPanel) {
                this.currentWebviewPanel.dispose();
                this.currentWebviewPanel = undefined;
            }
            
            const document = await vscode.workspace.openTextDocument(result.file);
            const targetViewColumn = this.originalEditor?.viewColumn || vscode.ViewColumn.One;
            const editor = await vscode.window.showTextDocument(document, targetViewColumn);
            
            const position = new vscode.Position(result.line - 1, result.column - 1);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            
            // Reset the search path
            this.currentSearchPath = undefined;
        } catch (error) {
            vscode.window.showErrorMessage(`Error navigating to result: ${error}`);
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