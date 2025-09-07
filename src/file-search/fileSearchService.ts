/**
 * File search service providing fuzzy file matching using Fuse.js.
 * Handles file discovery, filtering, and search result ranking.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import Fuse from "fuse.js";

export interface FileSearchResult {
  file: string;
  name: string;
  relativePath: string;
  size: number;
  modified: Date;
  isDirectory: boolean;
}

interface SearchOptions {
  maxResults: number;
  maxDepth: number;
  includeHidden: boolean;
  followSymlinks: boolean;
  excludePatterns: string[];
  includeDirectories: boolean;
}

/**
 * Service for fuzzy file searching with configurable options.
 */
export class FileSearchService {
  // Layout-aware context sizes
  private static readonly HORIZONTAL_CONTEXT_SIZE = 10;
  private static readonly VERTICAL_CONTEXT_SIZE = 60;

  private defaultOptions: SearchOptions = {
    maxResults: 500,
    maxDepth: 8,
    includeHidden: false,
    followSymlinks: false,
    includeDirectories: false,
    excludePatterns: [
      "node_modules/**",
      ".git/**",
      "*.log",
      "target/**",
      "dist/**",
      "build/**",
      ".vscode-test/**",
      "coverage/**",
      ".nyc_output/**",
      "out/**",
    ],
  };

  private fuseOptions = {
    keys: [
      { name: "name", weight: 0.7 },
      { name: "relativePath", weight: 0.3 },
    ],
    threshold: 0.6, // Lower = more strict matching
    includeScore: true,
    minMatchCharLength: 1,
    shouldSort: true,
    location: 0,
    distance: 100,
  };

  /**
   * Creates a new FileSearchService instance with default configuration.
   */
  constructor() {
    this.refreshConfiguration();
  }

  /**
   * Updates service configuration from VSCode settings.
   */
  private updateConfiguration(): void {
    const config = vscode.workspace.getConfiguration("quickFind");

    // Use existing maxResults setting or default
    this.defaultOptions.maxResults = config.get<number>("maxResults", 500);
  }

  /**
   * Refreshes configuration from VSCode settings.
   */
  public refreshConfiguration(): void {
    this.updateConfiguration();
  }

  /**
   * Searches for files matching the query using fuzzy matching.
   * @param folderPath - Root folder path to search in
   * @param query - Search query for fuzzy file name matching
   */
  async searchFiles(
    folderPath: string,
    query: string = "",
  ): Promise<FileSearchResult[]> {
    try {
      // First, discover all files
      const files = await this.discoverFiles(folderPath);

      // If no query, return all files (up to limit)
      if (!query.trim()) {
        return files.slice(0, this.defaultOptions.maxResults);
      }

      // Use Fuse.js for fuzzy searching
      const fuse = new Fuse(files, this.fuseOptions);
      const searchResults = fuse.search(query);

      // Extract items from Fuse results and limit
      return searchResults
        .map((result) => result.item)
        .slice(0, this.defaultOptions.maxResults);
    } catch (error) {
      console.error(`Error searching files in ${folderPath}:`, error);
      return [];
    }
  }

  /**
   * Gets the context size based on layout mode.
   */
  public getContextSize(isVerticalLayout: boolean = false): number {
    return isVerticalLayout
      ? FileSearchService.VERTICAL_CONTEXT_SIZE
      : FileSearchService.HORIZONTAL_CONTEXT_SIZE;
  }

  /**
   * Gets file content preview for context display.
   * @param filePath - Path to the file to preview
   * @param contextSize - Number of lines to include in preview
   */
  async getFileContext(
    filePath: string,
    contextSize: number,
  ): Promise<string[]> {
    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      const lines = content.split("\n");
      return lines.slice(0, contextSize);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return ["Error loading file content"];
    }
  }

  /**
   * Formats file size in human-readable format.
   * @param bytes - File size in bytes
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  /**
   * Discovers all searchable files in a directory tree.
   * @param basePath - Root directory path to start discovery from
   */
  private async discoverFiles(basePath: string): Promise<FileSearchResult[]> {
    try {
      const files: FileSearchResult[] = [];

      // Read .gitignore patterns if available
      const ignorePatterns = await this.loadIgnorePatterns(basePath);

      await this.walkDirectory(basePath, basePath, files, ignorePatterns, 0);

      // Sort by name for consistent ordering
      return files.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error(`Error discovering files in ${basePath}:`, error);
      return [];
    }
  }

  /**
   * Recursively walks directory tree to find files.
   * @param currentPath - Current directory being processed
   * @param basePath - Original root directory path
   * @param files - Array to accumulate found files
   * @param ignorePatterns - Patterns to ignore during traversal
   * @param depth - Current recursion depth
   */
  private async walkDirectory(
    currentPath: string,
    basePath: string,
    files: FileSearchResult[],
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

        // Skip hidden files/directories unless explicitly allowed
        if (!this.defaultOptions.includeHidden && entry.name.startsWith(".")) {
          continue;
        }

        try {
          const stats = await fs.promises.stat(fullPath);

          if (entry.isDirectory()) {
            // Add directory if configured to include them
            if (this.defaultOptions.includeDirectories) {
              files.push({
                file: fullPath,
                name: entry.name,
                relativePath: relativePath,
                size: 0,
                modified: stats.mtime,
                isDirectory: true,
              });
            }

            // Recurse into directory
            await this.walkDirectory(
              fullPath,
              basePath,
              files,
              ignorePatterns,
              depth + 1,
            );
          } else if (entry.isFile()) {
            files.push({
              file: fullPath,
              name: entry.name,
              relativePath: relativePath,
              size: stats.size,
              modified: stats.mtime,
              isDirectory: false,
            });
          }
        } catch (statError) {
          // Skip files we can't stat (permissions, broken symlinks, etc.)
          console.warn(`Cannot stat ${fullPath}:`, statError);
          continue;
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
}
