import * as vscode from 'vscode';
import { RegexSearchProvider } from './text-search/textSearchProvider';
import { FileSearchProvider } from './file-search/fileSearchProvider';

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

    context.subscriptions.push(searchInFileCommand);
    context.subscriptions.push(searchInFolderCommand);
    context.subscriptions.push(searchFilesCommand);
}

export function deactivate() {
    // Cleanup logic if needed
}