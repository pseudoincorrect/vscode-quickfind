import * as vscode from 'vscode';
import * as path from 'path';
import { RipgrepService } from './ripgrepService';
import { FuzzyMatcher } from './fuzzyMatcher';
import { SearchWebviewPanel } from './searchWebviewPanel';

export interface SearchResult {
    file: string;
    line: number;
    column: number;
    text: string;
    context: string[];
}

export class FuzzySearchProvider {
    private ripgrepService: RipgrepService;
    private fuzzyMatcher: FuzzyMatcher;
    private currentWebviewPanel: SearchWebviewPanel | undefined;
    private originalEditor: vscode.TextEditor | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.ripgrepService = new RipgrepService();
        this.fuzzyMatcher = new FuzzyMatcher();
    }

    async searchInCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        this.originalEditor = editor;
        
        try {
            const filePath = editor.document.fileName;
            const searchResults = await this.ripgrepService.searchInFile(filePath, '.');
            
            if (searchResults.length === 0) {
                vscode.window.showInformationMessage('No text found in current file');
                return;
            }
            
            this.showSearchWebview(searchResults, 'file');
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
        
        try {
            const folderPath = workspaceFolder.uri.fsPath;
            const searchResults = await this.ripgrepService.searchInFolder(folderPath, '.');
            
            if (searchResults.length === 0) {
                vscode.window.showInformationMessage('No text found in current folder');
                return;
            }
            
            this.showSearchWebview(searchResults, 'folder');
        } catch (error) {
            vscode.window.showErrorMessage(`Error searching in folder: ${error}`);
        }
    }

    private showSearchWebview(results: SearchResult[], searchType: 'file' | 'folder') {
        if (this.currentWebviewPanel) {
            this.currentWebviewPanel.dispose();
        }

        this.currentWebviewPanel = new SearchWebviewPanel(
            this.context,
            results,
            searchType,
            this.fuzzyMatcher,
            (result: SearchResult) => this.navigateToResult(result),
            () => this.returnToOriginalEditor()
        );
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
    }
}