import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SearchResult } from './searchProvider';

interface SearchOptions {
    maxFileSize: number;
    maxResults: number;
    maxDepth: number;
    includeHidden: boolean;
    followSymlinks: boolean;
    contextSize: number;
    excludePatterns: string[];
}

export class SearchService {
    private contextSize: number = 3;
    private defaultOptions: SearchOptions = {
        maxFileSize: 1024 * 1024, // 1MB
        maxResults: 1000,
        maxDepth: 8,
        includeHidden: false,
        followSymlinks: false,
        contextSize: 3,
        excludePatterns: [
            'node_modules/**',
            '.git/**',
            '*.log',
            'target/**',
            'dist/**',
            'build/**',
            '.vscode-test/**',
            'coverage/**'
        ]
    };

    constructor() {
        this.refreshConfiguration();
    }

    private updateContextSize(): void {
        const config = vscode.workspace.getConfiguration('regexSearch');
        this.contextSize = config.get<number>('contextSize', 3);
    }

    private parseFileSize(sizeStr: string): number {
        const units: { [key: string]: number } = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024,
        };

        const match = sizeStr.toUpperCase().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/);
        if (!match) {
            console.warn(`Invalid file size format: ${sizeStr}, using default 1MB`);
            return 1024 * 1024; // Default to 1MB
        }

        const value = parseFloat(match[1]);
        const unit = match[2] || 'B';
        return Math.floor(value * units[unit]);
    }

    private updateConfiguration(): void {
        const config = vscode.workspace.getConfiguration('regexSearch');
        
        // Update context size
        this.contextSize = config.get<number>('contextSize', 3);
        this.defaultOptions.contextSize = this.contextSize;
        
        // Update native search specific options
        const maxFileSizeStr = config.get<string>('maxFileSize', '1MB');
        this.defaultOptions.maxFileSize = this.parseFileSize(maxFileSizeStr);
        
        this.defaultOptions.maxResults = config.get<number>('maxResults', 1000);
    }

    public refreshConfiguration(): void {
        this.updateConfiguration();
    }

    public getContextSize(): number {
        return this.contextSize;
    }

    async searchInFile(filePath: string, pattern: string): Promise<SearchResult[]> {
        try {
            // Check file size first
            const stats = await fs.promises.stat(filePath);
            if (stats.size > this.defaultOptions.maxFileSize) {
                console.warn(`File ${filePath} is too large (${stats.size} bytes), skipping`);
                return [];
            }

            const content = await fs.promises.readFile(filePath, 'utf8');
            const results = await this.searchInContent(content, pattern, filePath);
            
            return results.slice(0, this.defaultOptions.maxResults);
        } catch (error) {
            console.error(`Error searching in file ${filePath}:`, error);
            return [];
        }
    }

    async searchInFolder(folderPath: string, pattern: string): Promise<SearchResult[]> {
        try {
            const files = await this.discoverFiles(folderPath);
            const results: SearchResult[] = [];

            // Process files in batches to avoid overwhelming the system
            const batchSize = 10;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                const batchPromises = batch.map(file => this.searchInFile(file, pattern));
                const batchResults = await Promise.all(batchPromises);
                
                // Flatten and add to results
                batchResults.forEach(fileResults => {
                    results.push(...fileResults);
                });

                // Stop if we have enough results
                if (results.length >= this.defaultOptions.maxResults) {
                    break;
                }
            }

            return results.slice(0, this.defaultOptions.maxResults);
        } catch (error) {
            console.error(`Error searching in folder ${folderPath}:`, error);
            return [];
        }
    }

    async searchWithQuery(searchPath: string, query: string, isFile: boolean = false): Promise<SearchResult[]> {
        if (!query.trim()) {
            return [];
        }

        if (isFile) {
            return this.searchInFile(searchPath, query);
        } else {
            return this.searchInFolder(searchPath, query);
        }
    }

    async loadContextForResult(result: SearchResult): Promise<SearchResult> {
        if (result.context.length > 1) {
            return result; // Already loaded
        }

        const context = await this.readContextLines(result.file, result.line);
        return {
            ...result,
            context: context
        };
    }

    public getServiceInfo(): { service: string; version?: string } {
        return { service: 'native' };
    }

    private async discoverFiles(basePath: string): Promise<string[]> {
        try {
            const files: string[] = [];
            
            // Read .gitignore patterns if available
            const ignorePatterns = await this.loadIgnorePatterns(basePath);
            
            await this.walkDirectory(basePath, basePath, files, ignorePatterns, 0);
            
            return files;
        } catch (error) {
            console.error(`Error discovering files in ${basePath}:`, error);
            return [];
        }
    }

    private async walkDirectory(
        currentPath: string, 
        basePath: string, 
        files: string[], 
        ignorePatterns: string[], 
        depth: number
    ): Promise<void> {
        if (depth > this.defaultOptions.maxDepth) {
            return;
        }

        try {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                const relativePath = path.relative(basePath, fullPath);

                // Skip if matches ignore patterns
                if (this.shouldIgnore(relativePath, ignorePatterns)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    // Skip hidden directories unless explicitly allowed
                    if (!this.defaultOptions.includeHidden && entry.name.startsWith('.')) {
                        continue;
                    }
                    
                    await this.walkDirectory(fullPath, basePath, files, ignorePatterns, depth + 1);
                } else if (entry.isFile()) {
                    // Skip hidden files unless explicitly allowed
                    if (!this.defaultOptions.includeHidden && entry.name.startsWith('.')) {
                        continue;
                    }

                    // Check file extension
                    if (this.isTextFile(entry.name)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Skip directories we can't read (permissions, etc.)
            console.warn(`Cannot read directory ${currentPath}:`, error);
        }
    }

    private async loadIgnorePatterns(basePath: string): Promise<string[]> {
        const patterns = [...this.defaultOptions.excludePatterns];
        
        try {
            const gitignorePath = path.join(basePath, '.gitignore');
            const gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf8');
            const gitignoreLines = gitignoreContent
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
            patterns.push(...gitignoreLines);
        } catch {
            // .gitignore doesn't exist or can't be read
        }

        return patterns;
    }

    private shouldIgnore(relativePath: string, ignorePatterns: string[]): boolean {
        const normalizedPath = relativePath.replace(/\\/g, '/');
        
        for (const pattern of ignorePatterns) {
            const normalizedPattern = pattern.replace(/\\/g, '/');
            
            // Simple glob matching - can be enhanced with a proper glob library
            if (this.matchesPattern(normalizedPath, normalizedPattern)) {
                return true;
            }
        }
        
        return false;
    }

    private matchesPattern(path: string, pattern: string): boolean {
        // Simple pattern matching - basic implementation
        if (pattern.endsWith('/**')) {
            const prefix = pattern.slice(0, -3);
            return path.startsWith(prefix + '/') || path === prefix;
        }
        
        if (pattern.includes('*')) {
            // Convert glob pattern to regex (basic implementation)
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*');
            
            try {
                const regex = new RegExp(`^${regexPattern}$`);
                return regex.test(path);
            } catch {
                return false;
            }
        }
        
        return path === pattern || path.startsWith(pattern + '/');
    }

    private isTextFile(filename: string): boolean {
        const textExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss', '.json', '.md', '.txt',
            '.py', '.java', '.cpp', '.c', '.h', '.go', '.rs', '.php', '.rb', '.swift', '.kt',
            '.yaml', '.yml', '.toml', '.ini', '.conf', '.config', '.env', '.xml', '.svg'
        ];
        
        const ext = path.extname(filename).toLowerCase();
        return textExtensions.includes(ext);
    }

    private async searchInContent(content: string, pattern: string, filePath: string): Promise<SearchResult[]> {
        const results: SearchResult[] = [];
        const lines = content.split('\n');

        try {
            // Create case-insensitive regex
            const regex = new RegExp(pattern, 'gi');

            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                let match;

                // Reset regex lastIndex to ensure we find all matches in the line
                regex.lastIndex = 0;

                while ((match = regex.exec(line)) !== null) {
                    results.push({
                        file: filePath,
                        line: lineIndex + 1, // 1-based line numbers
                        column: match.index + 1, // 1-based column numbers
                        text: line.trim(),
                        context: [line.trim()] // Minimal context, will be loaded on demand
                    });

                    // Prevent infinite loop with zero-width matches
                    if (match.index === regex.lastIndex) {
                        regex.lastIndex++;
                    }

                    // Limit matches per line to avoid performance issues
                    if (results.length >= 100) {
                        break;
                    }
                }

                if (results.length >= 100) {
                    break;
                }
            }
        } catch (error) {
            // If regex is invalid, fall back to literal string search
            console.warn(`Invalid regex pattern "${pattern}", falling back to literal search`);
            return this.searchLiteral(content, pattern, filePath);
        }

        return results;
    }

    private searchLiteral(content: string, searchTerm: string, filePath: string): SearchResult[] {
        const results: SearchResult[] = [];
        const lines = content.split('\n');
        const lowerSearchTerm = searchTerm.toLowerCase();

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const lowerLine = line.toLowerCase();
            let startIndex = 0;

            while (true) {
                const matchIndex = lowerLine.indexOf(lowerSearchTerm, startIndex);
                if (matchIndex === -1) {
                    break;
                }

                results.push({
                    file: filePath,
                    line: lineIndex + 1,
                    column: matchIndex + 1,
                    text: line.trim(),
                    context: [line.trim()]
                });

                startIndex = matchIndex + 1;

                // Limit matches per line
                if (results.length >= 100) {
                    break;
                }
            }

            if (results.length >= 100) {
                break;
            }
        }

        return results;
    }

    private async readContextLines(filePath: string, targetLine: number): Promise<string[]> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            
            const startLine = Math.max(0, targetLine - this.contextSize - 1);
            const endLine = Math.min(lines.length, targetLine + this.contextSize);
            
            return lines.slice(startLine, endLine);
        } catch (error) {
            console.error(`Error reading context from ${filePath}:`, error);
            return [];
        }
    }
}
