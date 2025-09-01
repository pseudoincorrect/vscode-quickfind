import * as vscode from 'vscode';
import * as path from 'path';
import { RipgrepService } from './ripgrepService';
import { SearchWebviewPanel } from './searchWebviewPanel';

export interface SearchResult {
    file: string;
    line: number;
    column: number;
    text: string;
    context: string[];
}

export class RegexSearchProvider {
    private ripgrepService: RipgrepService;
    private currentWebviewPanel: SearchWebviewPanel | undefined;
    private originalEditor: vscode.TextEditor | undefined;
    private initialResults: SearchResult[] = [];
    private currentSearchPath: string | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.ripgrepService = new RipgrepService();
    }

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
            (result: SearchResult) => this.loadContextForResult(result), // Add context loading callback
            this.currentSearchPath,
            currentViewColumn
        );
    }

    private async performSearch(query: string, searchType: 'file' | 'folder'): Promise<SearchResult[]> {
        if (!query.trim()) {
            return this.initialResults;
        }

        try {
            if (searchType === 'file') {
                if (!this.currentSearchPath) {
                    return [];
                }
                return await this.ripgrepService.searchWithQuery(this.currentSearchPath, query, true);
            } else {
                if (!this.currentSearchPath) {
                    return [];
                }
                return await this.ripgrepService.searchWithQuery(this.currentSearchPath, query, false);
            }
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    private async loadContextForResult(result: SearchResult): Promise<SearchResult> {
        return await this.ripgrepService.loadContextForResult(result);
    }

    private async navigateToResult(result: SearchResult) {
        try {
            const document = await vscode.workspace.openTextDocument(result.file);
            const editor = await vscode.window.showTextDocument(document);
            
            const position = new vscode.Position(result.line - 1, result.column - 1);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            
            if (this.currentWebviewPanel) {
                this.currentWebviewPanel.dispose();
                this.currentWebviewPanel = undefined;
            }
            
            // Reset the search path
            this.currentSearchPath = undefined;
        } catch (error) {
            vscode.window.showErrorMessage(`Error navigating to result: ${error}`);
        }
    }

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