import * as vscode from 'vscode';
import { FuzzySearchProvider } from './fuzzySearchProvider';

export function activate(context: vscode.ExtensionContext) {
    const fuzzySearchProvider = new FuzzySearchProvider(context);

    // Register command for searching in current file
    const searchInFileCommand = vscode.commands.registerCommand('fuzzySearch.searchInFile', () => {
        fuzzySearchProvider.searchInCurrentFile();
    });

    // Register command for searching in current folder/workspace
    const searchInFolderCommand = vscode.commands.registerCommand('fuzzySearch.searchInFolder', () => {
        fuzzySearchProvider.searchInCurrentFolder();
    });

    context.subscriptions.push(searchInFileCommand);
    context.subscriptions.push(searchInFolderCommand);
}

export function deactivate() {
    // Cleanup logic if needed
}