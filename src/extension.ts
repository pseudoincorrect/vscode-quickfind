import * as vscode from 'vscode';
import { RegexSearchProvider } from './fuzzySearchProvider';

export function activate(context: vscode.ExtensionContext) {
    const regexSearchProvider = new RegexSearchProvider(context);

    // Register command for searching in current file
    const searchInFileCommand = vscode.commands.registerCommand('fuzzySearch.searchInFile', () => {
        regexSearchProvider.searchInCurrentFile();
    });

    // Register command for searching in current folder/workspace
    const searchInFolderCommand = vscode.commands.registerCommand('fuzzySearch.searchInFolder', () => {
        regexSearchProvider.searchInCurrentFolder();
    });

    context.subscriptions.push(searchInFileCommand);
    context.subscriptions.push(searchInFolderCommand);
}

export function deactivate() {
    // Cleanup logic if needed
}