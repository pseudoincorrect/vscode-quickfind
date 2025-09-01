import * as cp from 'child_process';
import * as path from 'path';
import { SearchResult } from './searchProvider';

export class RipgrepService {
    private readonly rgPath = '/usr/bin/rg';

    async searchInFile(filePath: string, pattern: string): Promise<SearchResult[]> {
        return new Promise((resolve, reject) => {
            // Use ripgrep to search within a single file with line numbers only
            const args = [
                '--line-number',           // Show line numbers
                '--column',               // Show column numbers  
                '--with-filename',        // Include filename in output
                '--no-heading',           // Don't group by filename
                '--color', 'never',       // Disable color output
                '--ignore-case',          // Case insensitive search
                '--max-count', '500',     // Limit results per file for performance
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

            rg.on('close', async (code) => {
                if (code === 0 || code === 1) {
                    // Code 0: matches found, Code 1: no matches (not an error)
                    try {
                        const results = await this.parseRipgrepOutputSimple(output, filePath, false); // Don't load context initially
                        resolve(results);
                    } catch (error) {
                        reject(new Error(`Failed to parse ripgrep output: ${error}`));
                    }
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
                '--with-filename',        // Include filename in output
                '--no-heading',           // Don't group by filename
                '--color', 'never',       // Disable color output
                '--ignore-case',          // Case insensitive search
                '--max-count', '10',      // Limit results per file to 10 for folder searches
                '--max-filesize', '1M',   // Skip files larger than 1MB
                '--type-add', 'web:*.{js,ts,jsx,tsx,html,css,scss,json,md}', // Common web files
                '--type-add', 'config:*.{yaml,yml,toml,ini,conf}',           // Config files
                '--hidden',               // Search hidden files
                '--follow',               // Follow symbolic links  
                '--max-depth', '8',       // Limit recursion depth (reduced from 10)
                '--no-ignore',            // Don't use any ignore files
                '--glob', '!.git/',       // Explicitly exclude .git directory
                '--glob', '!node_modules/', // Explicitly exclude node_modules
                '--glob', '!*.log',       // Exclude log files
                '--glob', '!target/',     // Exclude Rust target directory
                '--glob', '!dist/',       // Exclude build directories
                '--glob', '!build/',      // Exclude build directories
                // '--respect-gitignore',    // Respect .gitignore files -- note: does not work
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

            rg.on('close', async (code) => {
                if (code === 0 || code === 1) {
                    // Code 0: matches found, Code 1: no matches (not an error)
                    try {
                        const results = await this.parseRipgrepOutputSimple(output, folderPath, false);
                        resolve(results);
                    } catch (error) {
                        reject(new Error(`Failed to parse ripgrep output: ${error}`));
                    }
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

        // Use the query as-is for regex search (don't escape)
        if (isFile) {
            return this.searchInFile(searchPath, query);
        } else {
            return this.searchInFolder(searchPath, query);
        }
    }

    // Public method to load context for a specific search result on-demand
    async loadContextForResult(result: SearchResult): Promise<SearchResult> {
        if (result.context.length > 1) {
            // Context already loaded
            return result;
        }

        const context = await this.readContextLines(result.file, result.line);
        return {
            ...result,
            context: context
        };
    }

    private async parseRipgrepOutputSimple(output: string, basePath: string, withContext: boolean = false): Promise<SearchResult[]> {
        const results: SearchResult[] = [];
        const lines = output.split('\n').filter(line => line.trim());

        for (const line of lines) {
            // Parse simple ripgrep output: file:line:column:text
            const match = line.match(/^([^:]+):(\d+):(\d+):(.*)$/);
            if (match) {
                const [, filePath, lineNum, columnNum, text] = match;
                const lineNumber = parseInt(lineNum, 10);
                
                // Only read context if explicitly requested (for lazy loading)
                const context = withContext ? await this.readContextLines(filePath, lineNumber) : [text.trim()];
                
                results.push({
                    file: filePath,
                    line: lineNumber,
                    column: parseInt(columnNum, 10),
                    text: text.trim(),
                    context: context
                });
            }
        }

        return results;
    }

    private async readContextLines(filePath: string, targetLine: number, contextSize: number = 3): Promise<string[]> {
        return new Promise((resolve) => {
            const startLine = Math.max(1, targetLine - contextSize);
            const endLine = targetLine + contextSize;
            
            // Use sed to extract lines with context around the match
            const args = ['-n', `${startLine},${endLine}p`, filePath];
            
            const sed = cp.spawn('sed', args);
            let output = '';
            
            sed.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            sed.on('close', () => {
                const lines = output.split('\n').filter(line => line.length > 0);
                resolve(lines);
            });
            
            sed.on('error', () => {
                // If sed fails, return empty context
                resolve([]);
            });
        });
    }

    private getRelativePath(fullPath: string, basePath: string): string {
        return path.relative(basePath, fullPath) || path.basename(fullPath);
    }
}