import * as vscode from 'vscode';
import { RegexSearchProvider } from './text-search/textSearchProvider';
import { FileSearchProvider } from './file-search/fileSearchProvider';

// Global variable to track the active QuickFind webview
let activeQuickFindPanel: vscode.WebviewPanel | null = null;

export function setActiveQuickFindPanel(panel: vscode.WebviewPanel | null) {
    activeQuickFindPanel = panel;
    
    // Update context to enable/disable keybindings
    vscode.commands.executeCommand('setContext', 'quickFindFocused', panel !== null);
}

export function activate(context: vscode.ExtensionContext) {
    const regexSearchProvider = new RegexSearchProvider(context);
    const fileSearchProvider = new FileSearchProvider(context);

    // Register command for searching in current file
    const searchInFileCommand = vscode.commands.registerCommand('quickFind.searchInFile', () => {
        regexSearchProvider.searchInCurrentFile();
    });

    // Register command for searching in current folder/workspace
    const searchInFolderCommand = vscode.commands.registerCommand('quickFind.searchInFolder', () => {
        regexSearchProvider.searchInCurrentFolder();
    });

    // Register command for file search
    const searchFilesCommand = vscode.commands.registerCommand('quickFind.searchFiles', () => {
        fileSearchProvider.searchFiles();
    });

    // Register command for previous search history
    const historyPreviousCommand = vscode.commands.registerCommand('quickFind.historyPrevious', () => {
        if (activeQuickFindPanel) {
            activeQuickFindPanel.webview.postMessage({ command: 'historyPrevious' });
        }
    });

    // Register command for next search history
    const historyNextCommand = vscode.commands.registerCommand('quickFind.historyNext', () => {
        if (activeQuickFindPanel) {
            activeQuickFindPanel.webview.postMessage({ command: 'historyNext' });
        }
    });

    context.subscriptions.push(searchInFileCommand);
    context.subscriptions.push(searchInFolderCommand);
    context.subscriptions.push(searchFilesCommand);
    context.subscriptions.push(historyPreviousCommand);
    context.subscriptions.push(historyNextCommand);
}

export function deactivate() {
    // Cleanup logic if needed
}