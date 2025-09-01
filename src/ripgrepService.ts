import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { SearchResult } from './searchProvider';

export class RipgrepService {
    private rgPath: string;
    private contextSize: number = 3; // Default value

    constructor() {
        this.rgPath = this.findRipgrepPath();
        this.updateContextSize();
    }

    private updateContextSize(): void {
        const config = vscode.workspace.getConfiguration('regexSearch');
        this.contextSize = config.get<number>('contextSize', 3);
    }

    public refreshConfiguration(): void {
        this.updateContextSize();
    }

    public getContextSize(): number {
        return this.contextSize;
    }

    private findRipgrepPath(): string {
        const platform = os.platform();
        const possiblePaths: string[] = [];

        if (platform === 'win32') {
            // Windows paths
            possiblePaths.push(
                'rg.exe',
                'rg',
                path.join(process.env.PROGRAMFILES || '', 'ripgrep', 'rg.exe'),
                path.join(process.env['PROGRAMFILES(X86)'] || '', 'ripgrep', 'rg.exe'),
                path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ripgrep', 'rg.exe')
            );
        } else if (platform === 'darwin') {
            // macOS paths
            possiblePaths.push(
                'rg',
                '/usr/local/bin/rg',
                '/opt/homebrew/bin/rg',
                '/usr/bin/rg'
            );
        } else {
            // Linux and other Unix-like systems
            possiblePaths.push(
                'rg',
                '/usr/bin/rg',
                '/usr/local/bin/rg',
                '/snap/bin/rg'
            );
        }

        // Try to find ripgrep in PATH first
        try {
            const whichCommand = platform === 'win32' ? 'where' : 'which';
            const result = cp.execSync(`${whichCommand} rg`, { encoding: 'utf8' }).trim();
            if (result) {
                return result.split('\n')[0]; // Take the first result
            }
        } catch (error) {
            // Continue to check predefined paths
        }

        // Check predefined paths
        for (const rgPath of possiblePaths) {
            try {
                if (path.isAbsolute(rgPath) && fs.existsSync(rgPath)) {
                    return rgPath;
                }
            } catch (error) {
                // Continue checking other paths
            }
        }

        // Fallback to just 'rg' and hope it's in PATH
        return 'rg';
    }

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
                if (error.message.includes('ENOENT')) {
                    reject(new Error(`Ripgrep (rg) not found. Please install ripgrep:\n` +
                        `- Windows: Download from https://github.com/BurntSushi/ripgrep/releases or use 'winget install BurntSushi.ripgrep.MSVC'\n` +
                        `- macOS: Use 'brew install ripgrep'\n` +
                        `- Linux: Use your package manager (e.g., 'apt install ripgrep', 'dnf install ripgrep', 'pacman -S ripgrep')`));
                } else {
                    reject(new Error(`Failed to start ripgrep: ${error.message}`));
                }
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
                if (error.message.includes('ENOENT')) {
                    reject(new Error(`Ripgrep (rg) not found. Please install ripgrep:\n` +
                        `- Windows: Download from https://github.com/BurntSushi/ripgrep/releases or use 'winget install BurntSushi.ripgrep.MSVC'\n` +
                        `- macOS: Use 'brew install ripgrep'\n` +
                        `- Linux: Use your package manager (e.g., 'apt install ripgrep', 'dnf install ripgrep', 'pacman -S ripgrep')`));
                } else {
                    reject(new Error(`Failed to start ripgrep: ${error.message}`));
                }
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

    private async readContextLines(filePath: string, targetLine: number): Promise<string[]> {
        return new Promise((resolve) => {
            const startLine = Math.max(1, targetLine - this.contextSize);
            const endLine = targetLine + this.contextSize;
            
            try {
                // Use Node.js fs to read the file instead of sed for cross-platform compatibility
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const lines = fileContent.split('\n');
                
                // Extract the relevant lines (convert to 0-based indexing)
                const contextLines = lines.slice(startLine - 1, endLine);
                resolve(contextLines.filter(line => line !== undefined));
            } catch (error) {
                // If reading fails, return empty context
                resolve([]);
            }
        });
    }

    private getRelativePath(fullPath: string, basePath: string): string {
        return path.relative(basePath, fullPath) || path.basename(fullPath);
    }
}