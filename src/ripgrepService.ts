import * as cp from 'child_process';
import * as path from 'path';
import { SearchResult } from './fuzzySearchProvider';

export class RipgrepService {
    private readonly rgPath = '/usr/bin/rg';

    async searchInFile(filePath: string, pattern: string): Promise<SearchResult[]> {
        return new Promise((resolve, reject) => {
            // Use ripgrep to search within a single file with line numbers and context
            const args = [
                '--line-number',           // Show line numbers
                '--column',               // Show column numbers  
                '--context', '3',         // Show 3 lines of context before and after
                '--with-filename',        // Include filename in output
                '--no-heading',           // Don't group by filename
                '--color', 'never',       // Disable color output
                pattern,
                filePath
            ];

            const rg = cp.spawn(this.rgPath, args);
            let output = '';
            let errorOutput = '';

            rg.stdout.on('data', (data) => {
                output += data.toString();
            });

            rg.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            rg.on('close', (code) => {
                if (code === 0 || code === 1) {
                    // Code 0: matches found, Code 1: no matches (not an error)
                    const results = this.parseRipgrepOutput(output, filePath);
                    resolve(results);
                } else {
                    reject(new Error(`Ripgrep failed with code ${code}: ${errorOutput}`));
                }
            });

            rg.on('error', (error) => {
                reject(new Error(`Failed to start ripgrep: ${error.message}`));
            });
        });
    }

    async searchInFolder(folderPath: string, pattern: string): Promise<SearchResult[]> {
        return new Promise((resolve, reject) => {
            // Use ripgrep to search in all files within a folder
            const args = [
                '--line-number',           // Show line numbers
                '--column',               // Show column numbers
                '--context', '2',         // Show 2 lines of context (less for folder search)
                '--with-filename',        // Include filename in output
                '--no-heading',           // Don't group by filename
                '--color', 'never',       // Disable color output
                '--type-add', 'web:*.{js,ts,jsx,tsx,html,css,scss,json,md}', // Common web files
                '--type-add', 'config:*.{yaml,yml,toml,ini,conf}',           // Config files
                '--hidden',               // Search hidden files
                '--follow',               // Follow symbolic links  
                '--max-depth', '10',      // Limit recursion depth
                pattern,
                folderPath
            ];

            const rg = cp.spawn(this.rgPath, args);
            let output = '';
            let errorOutput = '';

            rg.stdout.on('data', (data) => {
                output += data.toString();
            });

            rg.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            rg.on('close', (code) => {
                if (code === 0 || code === 1) {
                    // Code 0: matches found, Code 1: no matches (not an error)
                    const results = this.parseRipgrepOutput(output, folderPath);
                    resolve(results);
                } else {
                    reject(new Error(`Ripgrep failed with code ${code}: ${errorOutput}`));
                }
            });

            rg.on('error', (error) => {
                reject(new Error(`Failed to start ripgrep: ${error.message}`));
            });
        });
    }

    async searchWithQuery(searchPath: string, query: string, isFile: boolean = false): Promise<SearchResult[]> {
        if (!query.trim()) {
            return [];
        }

        // Escape special regex characters for literal search
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        if (isFile) {
            return this.searchInFile(searchPath, escapedQuery);
        } else {
            return this.searchInFolder(searchPath, escapedQuery);
        }
    }

    private parseRipgrepOutput(output: string, basePath: string): SearchResult[] {
        const results: SearchResult[] = [];
        const lines = output.split('\n').filter(line => line.trim());

        let currentResult: Partial<SearchResult> | null = null;
        let contextLines: string[] = [];

        for (const line of lines) {
            // Parse ripgrep output format: filename:line:column:text
            // Context lines have format: filename-line-text
            const matchResult = line.match(/^([^:]+):(\d+):(\d+):(.*)$/);
            const contextMatch = line.match(/^([^:]+)-(\d+)-(.*)$/);

            if (matchResult) {
                // This is a search match result
                const [, filePath, lineNum, columnNum, text] = matchResult;
                
                // If we have a previous result, save it
                if (currentResult && currentResult.file) {
                    results.push({
                        file: currentResult.file,
                        line: currentResult.line!,
                        column: currentResult.column!,
                        text: currentResult.text!,
                        context: [...contextLines]
                    });
                }

                // Start a new result
                currentResult = {
                    file: filePath,
                    line: parseInt(lineNum, 10),
                    column: parseInt(columnNum, 10),
                    text: text.trim()
                };
                contextLines = [];

            } else if (contextMatch && currentResult) {
                // This is a context line for the current result
                const [, , , contextText] = contextMatch;
                contextLines.push(contextText);
            }
        }

        // Don't forget the last result
        if (currentResult && currentResult.file) {
            results.push({
                file: currentResult.file,
                line: currentResult.line!,
                column: currentResult.column!,
                text: currentResult.text!,
                context: [...contextLines]
            });
        }

        return results;
    }

    private getRelativePath(fullPath: string, basePath: string): string {
        return path.relative(basePath, fullPath) || path.basename(fullPath);
    }
}