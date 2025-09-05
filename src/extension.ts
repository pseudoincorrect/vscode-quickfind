/**
 * Main extension entry point for QuickFind VSCode extension.
 * Provides fast text and file search with webview panels and history tracking.
 */

import * as vscode from 'vscode';
import { RegexSearchProvider } from './text-search/textSearchProvider';
import { FileSearchProvider } from './file-search/fileSearchProvider';

// Global variable to track the active QuickFind webview
let activeQuickFindPanel: vscode.WebviewPanel | null = null;

/**
 * Sets the currently active QuickFind panel and updates VSCode context.
 * @param panel - The webview panel to set as active, or null to clear
 */
export function setActiveQuickFindPanel(panel: vscode.WebviewPanel | null) {
    activeQuickFindPanel = panel;
    
    // Update context to enable/disable keybindings
    vscode.commands.executeCommand('setContext', 'quickFindFocused', panel !== null);
}

/**
 * Activates the extension and registers all commands and providers.
 * @param context - VSCode extension context for subscriptions and resources
 */
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

    // Register command for clearing search history
    const clearHistoryCommand = vscode.commands.registerCommand('quickFind.clearHistory', async () => {
        try {
            const fs = require('fs');
            const HISTORY_FILE = '/tmp/vscode-quickfind-text-search-history.json';
            
            // Clear the history file directly
            fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf8');
            
            // If there's an active panel, also clear its in-memory history
            if (activeQuickFindPanel) {
                activeQuickFindPanel.webview.postMessage({ command: 'historyCleared' });
            }
            
            vscode.window.showInformationMessage('Search history cleared successfully');
        } catch (error) {
            console.error('Error clearing search history:', error);
            vscode.window.showErrorMessage('Failed to clear search history');
        }
    });

    context.subscriptions.push(searchInFileCommand);
    context.subscriptions.push(searchInFolderCommand);
    context.subscriptions.push(searchFilesCommand);
    context.subscriptions.push(historyPreviousCommand);
    context.subscriptions.push(historyNextCommand);
    context.subscriptions.push(clearHistoryCommand);
}

/**
 * Deactivates the extension and performs cleanup.
 */
export function deactivate() {
    // Cleanup logic if needed
}