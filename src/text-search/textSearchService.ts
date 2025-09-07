/**
 * Core text search service providing file content searching with regex support.
 * Handles file discovery, pattern matching, and context loading for search results.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ConfigService, TextSearchConfig } from "../config/configService";

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  text: string;
  context: string[];
}

interface SearchOptions {
  maxFileSize: number;
  maxResults: number;
  maxDepth: number;
  includeHidden: boolean;
  followSymlinks: boolean;
  contextSize: number;
  excludePatterns: string[];
}

/**
 * Service for performing text searches in files and folders with configurable options.
 */
export class SearchService {
  // Layout-aware context sizes
  private static readonly HORIZONTAL_CONTEXT_SIZE = 10;
  private static readonly VERTICAL_CONTEXT_SIZE = 60;

  private configService: ConfigService;
  private defaultOptions: SearchOptions = {
    maxFileSize: 1024 * 1024, // 1MB
    maxResults: 1000,
    maxDepth: 8,
    includeHidden: false,
    followSymlinks: false,
    contextSize: SearchService.HORIZONTAL_CONTEXT_SIZE, // Default to horizontal
    excludePatterns: [
      "node_modules/**",
      ".git/**",
      "*.log",
      "target/**",
      "dist/**",
      "build/**",
      ".vscode-test/**",
      "coverage/**",
    ],
  };

  /**
   * Creates a new SearchService instance with default configuration.
   */
  constructor() {
    this.configService = new ConfigService();
    this.refreshConfiguration();
  }

  /**
   * Parses file size string (e.g., '1MB') into bytes.
   * @param sizeStr - File size string like '1MB', '500KB'
   */
  private parseFileSize(sizeStr: string): number {
    const units: { [key: string]: number } = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };

    const match = sizeStr
      .toUpperCase()
      .match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/);
    if (!match) {
      console.warn(`Invalid file size format: ${sizeStr}, using default 1MB`);
      return 1024 * 1024; // Default to 1MB
    }

    const value = parseFloat(match[1]);
    const unit = match[2] || "B";
    return Math.floor(value * units[unit]);
  }

  /**
   * Updates service configuration from VSCode settings.
   */
  private updateConfiguration(): void {
    const config = vscode.workspace.getConfiguration("quickFind");

    // Update native search specific options
    const maxFileSizeStr = config.get<string>("maxFileSize", "1MB");
    this.defaultOptions.maxFileSize = this.parseFileSize(maxFileSizeStr);

    this.defaultOptions.maxResults = config.get<number>("maxResults", 1000);
  }

  /**
   * Refreshes configuration from VSCode settings.
   */
  public refreshConfiguration(): void {
    this.updateConfiguration();
  }

  /**
   * Gets the context size based on layout mode.
   */
  public getContextSize(isVerticalLayout: boolean = false): number {
    return isVerticalLayout
      ? SearchService.VERTICAL_CONTEXT_SIZE
      : SearchService.HORIZONTAL_CONTEXT_SIZE;
  }

  /**
   * Gets the current search configuration.
   */
  public getSearchConfig(): TextSearchConfig {
    return this.configService.getTextSearchConfig();
  }

  /**
   * Updates search configuration with partial updates.
   * @param updates - Partial configuration object with properties to update
   */
  public updateSearchConfig(updates: Partial<TextSearchConfig>): void {
    this.configService.updateTextSearchConfig(updates);
  }

  /**
   * Searches for a pattern within a single file.
   * @param filePath - Absolute path to the file to search
   * @param pattern - Regex pattern or literal string to search for
   */
  async searchInFile(
    filePath: string,
    pattern: string,
  ): Promise<SearchResult[]> {
    try {
      // Check file size first
      const stats = await fs.promises.stat(filePath);
      if (stats.size > this.defaultOptions.maxFileSize) {
        console.warn(
          `File ${filePath} is too large (${stats.size} bytes), skipping`,
        );
        return [];
      }

      const content = await fs.promises.readFile(filePath, "utf8");
      const results = await this.searchInContent(content, pattern, filePath);

      return results.slice(0, this.defaultOptions.maxResults);
    } catch (error) {
      console.error(`Error searching in file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Searches for a pattern across all files in a folder.
   * @param folderPath - Absolute path to the folder to search
   * @param pattern - Regex pattern or literal string to search for
   */
  async searchInFolder(
    folderPath: string,
    pattern: string,
  ): Promise<SearchResult[]> {
    try {
      const files = await this.discoverFiles(folderPath);
      const results: SearchResult[] = [];

      // Process files in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchPromises = batch.map((file) =>
          this.searchInFile(file, pattern),
        );
        const batchResults = await Promise.all(batchPromises);

        // Flatten and add to results
        batchResults.forEach((fileResults) => {
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

  /**
   * Performs search with query on specified path (file or folder).
   * @param searchPath - Path to search in (file or folder)
   * @param query - Search query/pattern
   * @param isFile - Whether the searchPath is a file (true) or folder (false)
   */
  async searchWithQuery(
    searchPath: string,
    query: string,
    isFile: boolean = false,
  ): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    if (isFile) {
      return this.searchInFile(searchPath, query);
    } else {
      return this.searchInFolder(searchPath, query);
    }
  }

  /**
   * Loads additional context lines around a search result.
   * @param result - Search result to load context for
   * @param isVerticalLayout - Whether using vertical layout (affects context size)
   */
  async loadContextForResult(
    result: SearchResult,
    isVerticalLayout: boolean = false,
  ): Promise<SearchResult> {
    if (result.context.length > 1) {
      return result; // Already loaded
    }

    const contextSize = this.getContextSize(isVerticalLayout);
    const context = await this.readContextLines(
      result.file,
      result.line,
      contextSize,
    );
    return {
      ...result,
      context: context,
    };
  }

  /**
   * Returns information about the search service.
   */
  public getServiceInfo(): { service: string; version?: string } {
    return { service: "native" };
  }

  /**
   * Discovers searchable files in a directory tree.
   * @param basePath - Root directory path to start discovery from
   */
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

  /**
   * Recursively walks directory tree to find text files.
   * @param currentPath - Current directory being processed
   * @param basePath - Original root directory path
   * @param files - Array to accumulate found file paths
   * @param ignorePatterns - Patterns to ignore during traversal
   * @param depth - Current recursion depth
   */
  private async walkDirectory(
    currentPath: string,
    basePath: string,
    files: string[],
    ignorePatterns: string[],
    depth: number,
  ): Promise<void> {
    if (depth > this.defaultOptions.maxDepth) {
      return;
    }

    try {
      const entries = await fs.promises.readdir(currentPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        // Skip if matches ignore patterns
        if (this.shouldIgnore(relativePath, ignorePatterns)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Skip hidden directories unless explicitly allowed
          if (
            !this.defaultOptions.includeHidden &&
            entry.name.startsWith(".")
          ) {
            continue;
          }

          await this.walkDirectory(
            fullPath,
            basePath,
            files,
            ignorePatterns,
            depth + 1,
          );
        } else if (entry.isFile()) {
          // Skip hidden files unless explicitly allowed
          if (
            !this.defaultOptions.includeHidden &&
            entry.name.startsWith(".")
          ) {
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

  /**
   * Loads ignore patterns from .gitignore and default excludes.
   * @param basePath - Directory path to look for .gitignore file
   */
  private async loadIgnorePatterns(basePath: string): Promise<string[]> {
    const patterns = [...this.defaultOptions.excludePatterns];

    try {
      const gitignorePath = path.join(basePath, ".gitignore");
      const gitignoreContent = await fs.promises.readFile(
        gitignorePath,
        "utf8",
      );
      const gitignoreLines = gitignoreContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
      patterns.push(...gitignoreLines);
    } catch {
      // .gitignore doesn't exist or can't be read
    }

    return patterns;
  }

  /**
   * Determines if a path should be ignored based on patterns.
   * @param relativePath - Relative path to check
   * @param ignorePatterns - Array of glob patterns to match against
   */
  private shouldIgnore(
    relativePath: string,
    ignorePatterns: string[],
  ): boolean {
    const normalizedPath = relativePath.replace(/\\/g, "/");

    for (const pattern of ignorePatterns) {
      const normalizedPattern = pattern.replace(/\\/g, "/");

      // Simple glob matching - can be enhanced with a proper glob library
      if (this.matchesPattern(normalizedPath, normalizedPattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Matches a path against a glob pattern.
   * @param path - Path to test
   * @param pattern - Glob pattern to match against
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Simple pattern matching - basic implementation
    if (pattern.endsWith("/**")) {
      const prefix = pattern.slice(0, -3);
      return path.startsWith(prefix + "/") || path === prefix;
    }

    if (pattern.includes("*")) {
      // Convert glob pattern to regex (basic implementation)
      const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*");

      try {
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(path);
      } catch {
        return false;
      }
    }

    return path === pattern || path.startsWith(pattern + "/");
  }

  /**
   * Determines if a file is a searchable text file.
   * @param filename - Name of the file to check
   */
  private isTextFile(filename: string): boolean {
    const textExtensions = [
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".html",
      ".css",
      ".scss",
      ".json",
      ".md",
      ".txt",
      ".py",
      ".java",
      ".cpp",
      ".c",
      ".h",
      ".go",
      ".rs",
      ".php",
      ".rb",
      ".swift",
      ".kt",
      ".yaml",
      ".yml",
      ".toml",
      ".ini",
      ".conf",
      ".config",
      ".env",
      ".xml",
      ".svg",
    ];

    const ext = path.extname(filename).toLowerCase();
    return textExtensions.includes(ext);
  }

  /**
   * Searches for pattern within file content using regex.
   * @param content - File content to search in
   * @param pattern - Regex pattern to search for
   * @param filePath - Path of the file being searched (for results)
   */
  private async searchInContent(
    content: string,
    pattern: string,
    filePath: string,
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const lines = content.split("\n");
    const config = this.getSearchConfig();

    try {
      let regexPattern = pattern;

      // Apply whole-word option
      if (config["whole-word"]) {
        regexPattern = `\\b${regexPattern}\\b`;
      }

      // Create regex with case sensitivity based on config
      const flags = config["case-sensitive"] ? "g" : "gi";
      const regex = new RegExp(regexPattern, flags);

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
            context: [line.trim()], // Minimal context, will be loaded on demand
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
      console.warn(
        `Invalid regex pattern "${pattern}", falling back to literal search`,
      );
      return this.searchLiteral(content, pattern, filePath);
    }

    return results;
  }

  /**
   * Performs literal string search as fallback for invalid regex.
   * @param content - File content to search in
   * @param searchTerm - Literal string to search for
   * @param filePath - Path of the file being searched (for results)
   */
  private searchLiteral(
    content: string,
    searchTerm: string,
    filePath: string,
  ): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = content.split("\n");
    const config = this.getSearchConfig();

    // Apply case sensitivity
    const searchPattern = config["case-sensitive"]
      ? searchTerm
      : searchTerm.toLowerCase();

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const searchLine = config["case-sensitive"] ? line : line.toLowerCase();
      let startIndex = 0;

      while (true) {
        let matchIndex = searchLine.indexOf(searchPattern, startIndex);
        if (matchIndex === -1) {
          break;
        }

        // Apply whole-word option for literal search
        if (config["whole-word"]) {
          // Check if the match is a whole word
          const beforeChar = matchIndex > 0 ? searchLine[matchIndex - 1] : "";
          const afterChar =
            matchIndex + searchPattern.length < searchLine.length
              ? searchLine[matchIndex + searchPattern.length]
              : "";

          const isWordBoundaryBefore =
            matchIndex === 0 || /\W/.test(beforeChar);
          const isWordBoundaryAfter =
            matchIndex + searchPattern.length === searchLine.length ||
            /\W/.test(afterChar);

          if (!isWordBoundaryBefore || !isWordBoundaryAfter) {
            startIndex = matchIndex + 1;
            continue;
          }
        }

        results.push({
          file: filePath,
          line: lineIndex + 1,
          column: matchIndex + 1,
          text: line.trim(),
          context: [line.trim()],
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

  /**
   * Reads context lines around a target line in a file.
   * @param filePath - Path to the file to read from
   * @param targetLine - Line number to read context around (1-based)
   */
  private async readContextLines(
    filePath: string,
    targetLine: number,
    contextSize: number,
  ): Promise<string[]> {
    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      const lines = content.split("\n");

      const startLine = Math.max(0, targetLine - contextSize - 1);
      const endLine = Math.min(lines.length, targetLine + contextSize);

      return lines.slice(startLine, endLine);
    } catch (error) {
      console.error(`Error reading context from ${filePath}:`, error);
      return [];
    }
  }
}
