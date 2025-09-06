# QuickFind Code Improvement Recommendations

This document outlines maintainability improvements for the QuickFind VSCode extension codebase, based on analysis of the current architecture and code patterns.

## Overview

The QuickFind extension has grown to include multiple complex features (text search, file search, history management, configuration) with some architectural debt that impacts maintainability. These improvements focus on separation of concerns, testability, and code clarity.

## Priority Improvements

### 1. Extract Constants and Configuration ⭐️⭐️⭐️

**Current Issue**: Magic numbers and hardcoded paths scattered throughout the codebase.

**Problems**:
- `/tmp/vscode-quickfind-text-search-history.json` appears in multiple files
- Hardcoded values like `1000` (max results), `100` (debounce timing)
- Platform-specific paths without abstraction

**Solution**: Create a central constants file

```typescript
// src/constants.ts
export const CONFIG_PATHS = {
  HISTORY_FILE: '/tmp/vscode-quickfind-text-search-history.json',
  CONFIG_FILE: '/tmp/vscode-quickfind-config.json'
} as const;

export const SEARCH_LIMITS = {
  MAX_RESULTS: 1000,
  MAX_FILE_SIZE: 1024 * 1024, // 1MB
  MAX_DEPTH: 8,
  BATCH_SIZE: 10,
  MAX_HISTORY_SIZE: 50
} as const;

export const UI_CONSTANTS = {
  CONTEXT_LOAD_DEBOUNCE_MS: 100,
  INITIAL_BATCH_SIZE: 50,
  LOAD_MORE_BATCH_SIZE: 25,
  SEARCH_DEBOUNCE_MS: 300
} as const;

export const LAYOUT_SIZES = {
  HORIZONTAL_CONTEXT_SIZE: 10,
  VERTICAL_CONTEXT_SIZE: 60
} as const;
```

**Files to update**:
- `src/extension.ts` (line 65 - hardcoded history file path)
- `src/text-search/textSearchService.ts` (lines 34-35, 39-54)
- `src/text-search/text-search-webview/textSearch.js` (lines 8-19)
- `src/text-search/textSearchWebviewPanel.ts` (line 374)

### 2. Implement Proper Error Handling ⭐️⭐️⭐️

**Current Issue**: Inconsistent error handling with generic catch blocks that mask specific errors.

**Problems**:
- `extension.ts:76-78` - Generic error logging without user feedback
- `textSearchService.ts:149-153` - Silent failures that could confuse users
- No error boundaries for webview communication failures

**Solution**: Create centralized error handling

```typescript
// src/utils/errorHandler.ts
export enum QuickFindErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_REGEX = 'INVALID_REGEX',
  SEARCH_TIMEOUT = 'SEARCH_TIMEOUT',
  CONFIG_LOAD_FAILED = 'CONFIG_LOAD_FAILED'
}

export class QuickFindError extends Error {
  constructor(
    message: string, 
    public readonly code: QuickFindErrorCode,
    public readonly context?: object
  ) {
    super(message);
    this.name = 'QuickFindError';
  }
}

export const handleFileSystemError = (error: unknown, operation: string): QuickFindError => {
  if (error instanceof Error) {
    if (error.message.includes('ENOENT')) {
      return new QuickFindError(
        `File not found during ${operation}`, 
        QuickFindErrorCode.FILE_NOT_FOUND,
        { operation, originalError: error.message }
      );
    }
    if (error.message.includes('EACCES')) {
      return new QuickFindError(
        `Permission denied during ${operation}`, 
        QuickFindErrorCode.PERMISSION_DENIED,
        { operation, originalError: error.message }
      );
    }
  }
  return new QuickFindError(
    `Unknown error during ${operation}`, 
    QuickFindErrorCode.CONFIG_LOAD_FAILED,
    { operation, originalError: String(error) }
  );
};

export const showUserError = (error: QuickFindError): void => {
  vscode.window.showErrorMessage(`QuickFind: ${error.message}`);
  console.error(`[QuickFind] ${error.code}:`, error.message, error.context);
};
```

**Files to update**:
- All files with try/catch blocks should use centralized error handling
- `src/text-search/textSearchService.ts` (lines 149-153, 184-187, 247-250)
- `src/config/configService.ts` (lines 65-67, 84-86)

### 3. Abstract File System Operations ⭐️⭐️⭐️

**Current Issue**: Direct `fs` usage throughout codebase without abstraction makes testing difficult and creates platform dependencies.

**Solution**: Create a file system abstraction layer

```typescript
// src/services/fileSystemService.ts
export interface IFileSystemService {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  stat(path: string): Promise<{ size: number; isFile: boolean; isDirectory: boolean }>;
  readdir(path: string): Promise<string[]>;
}

export class FileSystemService implements IFileSystemService {
  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
      throw handleFileSystemError(error, 'readFile');
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await this.mkdir(dir);
      await fs.promises.writeFile(filePath, content, 'utf8');
    } catch (error) {
      throw handleFileSystemError(error, 'writeFile');
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ... other methods
}

// src/services/fileSystemService.mock.ts (for testing)
export class MockFileSystemService implements IFileSystemService {
  private files = new Map<string, string>();
  
  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (!content) {
      throw new QuickFindError('File not found', QuickFindErrorCode.FILE_NOT_FOUND);
    }
    return content;
  }
  
  setFileContent(path: string, content: string): void {
    this.files.set(path, content);
  }
  
  // ... other mock methods
}
```

### 4. Introduce Dependency Injection ⭐️⭐️⭐️

**Current Issue**: Hard dependencies and tight coupling make components difficult to test and modify.

**Problems**:
- `SearchService` directly instantiates `ConfigService` (line 61)
- `SearchWebviewPanel` constructor has 8+ parameters
- No way to substitute implementations for testing

**Solution**: Implement a simple dependency injection container

```typescript
// src/container.ts
export type ServiceFactory<T> = () => T;

export class Container {
  private services = new Map<string, ServiceFactory<any>>();
  private instances = new Map<string, any>();

  register<T>(key: string, factory: ServiceFactory<T>): void {
    this.services.set(key, factory);
  }

  registerSingleton<T>(key: string, factory: ServiceFactory<T>): void {
    this.services.set(key, () => {
      if (!this.instances.has(key)) {
        this.instances.set(key, factory());
      }
      return this.instances.get(key);
    });
  }

  resolve<T>(key: string): T {
    const factory = this.services.get(key);
    if (!factory) {
      throw new Error(`Service ${key} not registered`);
    }
    return factory();
  }
}

// src/containerSetup.ts
export const setupContainer = (context: vscode.ExtensionContext): Container => {
  const container = new Container();
  
  container.registerSingleton('fileSystem', () => new FileSystemService());
  container.registerSingleton('config', () => new ConfigService(container.resolve('fileSystem')));
  container.registerSingleton('searchService', () => new SearchService(container.resolve('config')));
  container.registerSingleton('historyService', () => new SearchHistoryService(container.resolve('fileSystem')));
  
  return container;
};
```

**Refactored SearchService**:
```typescript
export class SearchService {
    constructor(private configService: ConfigService) {
        this.refreshConfiguration();
    }
    
    // Remove direct instantiation: this.configService = new ConfigService();
}
```

### 5. Create Domain Models ⭐️⭐️

**Current Issue**: Primitive obsession and inconsistent data structures throughout the codebase.

**Solution**: Define clear domain models with behavior

```typescript
// src/models/SearchHistory.ts
export class SearchHistoryEntry {
  constructor(
    public readonly query: string,
    public readonly timestamp: Date = new Date()
  ) {}
}

export class SearchHistory {
  private readonly entries: SearchHistoryEntry[];

  constructor(entries: SearchHistoryEntry[] = [], private readonly maxSize: number = 50) {
    this.entries = entries.slice(-maxSize); // Keep only recent entries
  }

  add(query: string): SearchHistory {
    if (!query.trim()) return this;
    
    // Remove existing entry if present
    const filtered = this.entries.filter(entry => entry.query !== query);
    const newEntry = new SearchHistoryEntry(query);
    const newEntries = [...filtered, newEntry].slice(-this.maxSize);
    
    return new SearchHistory(newEntries, this.maxSize);
  }

  getPrevious(currentIndex: number): string | null {
    const index = currentIndex - 1;
    return index >= 0 && index < this.entries.length ? this.entries[index].query : null;
  }

  getNext(currentIndex: number): string | null {
    const index = currentIndex + 1;
    return index >= 0 && index < this.entries.length ? this.entries[index].query : null;
  }

  toArray(): string[] {
    return this.entries.map(entry => entry.query);
  }

  static fromArray(queries: string[]): SearchHistory {
    const entries = queries.map(query => new SearchHistoryEntry(query));
    return new SearchHistory(entries);
  }
}

// src/models/SearchQuery.ts
export class SearchQuery {
  constructor(
    public readonly pattern: string,
    public readonly caseSensitive: boolean = false,
    public readonly wholeWord: boolean = false
  ) {}

  toRegex(): RegExp {
    let regexPattern = this.pattern;
    
    if (this.wholeWord) {
      regexPattern = `\\b${regexPattern}\\b`;
    }

    const flags = this.caseSensitive ? 'g' : 'gi';
    return new RegExp(regexPattern, flags);
  }

  isValid(): boolean {
    try {
      this.toRegex();
      return true;
    } catch {
      return false;
    }
  }
}

// src/models/SearchResult.ts
export class SearchResultCollection {
  constructor(
    private readonly results: SearchResult[],
    public readonly query: SearchQuery,
    public readonly maxResults: number = 1000
  ) {}

  getPage(offset: number, limit: number): SearchResult[] {
    return this.results.slice(offset, offset + limit);
  }

  getTotalCount(): number {
    return this.results.length;
  }

  isTruncated(): boolean {
    return this.results.length >= this.maxResults;
  }
}
```

### 6. Extract Business Logic from UI Components ⭐️⭐️⭐️

**Current Issue**: `SearchWebviewPanel` (479 lines) handles too many responsibilities.

**Current responsibilities**:
- Webview lifecycle management
- Search history persistence
- Configuration management
- File I/O operations
- Message routing
- Layout management

**Solution**: Break into focused service classes

```typescript
// src/services/searchHistoryService.ts
export class SearchHistoryService {
  constructor(
    private fileSystem: IFileSystemService,
    private historyPath: string = CONFIG_PATHS.HISTORY_FILE
  ) {}

  async load(): Promise<SearchHistory> {
    try {
      if (await this.fileSystem.exists(this.historyPath)) {
        const content = await this.fileSystem.readFile(this.historyPath);
        const queries = JSON.parse(content);
        return SearchHistory.fromArray(Array.isArray(queries) ? queries : []);
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
    return new SearchHistory();
  }

  async save(history: SearchHistory): Promise<void> {
    await this.fileSystem.writeFile(this.historyPath, JSON.stringify(history.toArray(), null, 2));
  }

  async clear(): Promise<void> {
    await this.fileSystem.writeFile(this.historyPath, JSON.stringify([], null, 2));
  }
}

// src/services/webviewMessageHandler.ts
export class WebviewMessageHandler {
  constructor(
    private searchService: SearchService,
    private historyService: SearchHistoryService,
    private onNavigate: (result: SearchResult) => void,
    private onCancel: () => void
  ) {}

  async handleMessage(message: any): Promise<any> {
    switch (message.command) {
      case 'search':
        return this.handleSearch(message.query);
      case 'loadHistory':
        return this.handleLoadHistory();
      case 'saveHistory':
        return this.handleSaveHistory(message.history);
      // ... other handlers
    }
  }

  private async handleSearch(query: string): Promise<SearchResult[]> {
    const searchQuery = new SearchQuery(query, /* config values */);
    if (!searchQuery.isValid()) {
      throw new QuickFindError('Invalid search pattern', QuickFindErrorCode.INVALID_REGEX);
    }
    return this.searchService.search(searchQuery);
  }
}

// Simplified SearchWebviewPanel
export class SearchWebviewPanel {
  constructor(
    private context: vscode.ExtensionContext,
    private messageHandler: WebviewMessageHandler,
    // ... fewer dependencies
  ) {
    // Focus only on webview lifecycle and UI concerns
  }
}
```

### 7. Implement TypeScript Strict Mode ⭐️⭐️

**Current Issue**: Loose typing with `any` types throughout the codebase reduces type safety.

**Problems**:
- `handleUpdateConfig(configUpdates: any)` in `textSearchWebviewPanel.ts:361`
- Missing return type annotations
- Optional chaining not used consistently

**Solution**: Enable strict TypeScript configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**Type definitions to add**:
```typescript
// src/types/webview.ts
export interface WebviewMessage {
  command: string;
  [key: string]: any;
}

export interface SearchMessage extends WebviewMessage {
  command: 'search';
  query: string;
}

export interface ConfigUpdateMessage extends WebviewMessage {
  command: 'updateConfig';
  config: Partial<TextSearchConfig>;
}

export type WebviewMessageTypes = SearchMessage | ConfigUpdateMessage | /* ... other types */;
```

### 8. Add Comprehensive Logging ⭐️⭐️

**Current Issue**: Inconsistent logging with direct `console.error/warn` calls.

**Solution**: Structured logging service

```typescript
// src/services/loggingService.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogContext {
  [key: string]: any;
}

export class LoggingService {
  constructor(private minLevel: LogLevel = LogLevel.INFO) {}

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error ? { error: error.message, stack: error.stack } : {};
    this.log(LogLevel.ERROR, message, { ...context, ...errorContext });
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (level < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const contextStr = context ? JSON.stringify(context) : '';
    
    console.log(`[${timestamp}] [QuickFind] ${levelName}: ${message} ${contextStr}`);
  }
}
```

### 9. Create Integration Tests ⭐️

**Current Issue**: No visible test coverage for complex webview interactions and user workflows.

**Solution**: Add integration tests for key scenarios

```typescript
// tests/integration/searchWorkflow.test.ts
import { MockFileSystemService } from '../src/services/fileSystemService.mock';
import { SearchService } from '../src/text-search/textSearchService';
import { SearchHistory } from '../src/models/SearchHistory';

describe('Search Workflow Integration', () => {
  let mockFileSystem: MockFileSystemService;
  let searchService: SearchService;

  beforeEach(() => {
    mockFileSystem = new MockFileSystemService();
    searchService = new SearchService(/* dependencies */);
  });

  test('should perform complete search and history cycle', async () => {
    // Setup test files
    mockFileSystem.setFileContent('/test/file.js', 'function test() { return true; }');
    
    // Perform search
    const results = await searchService.searchInFolder('/test', 'function');
    
    expect(results).toHaveLength(1);
    expect(results[0].text).toContain('function test()');
    
    // Test history addition
    const history = new SearchHistory();
    const updatedHistory = history.add('function');
    
    expect(updatedHistory.toArray()).toEqual(['function']);
  });

  test('should handle invalid regex gracefully', async () => {
    const results = await searchService.searchInFolder('/test', '[invalid');
    // Should fallback to literal search, not throw
    expect(results).toEqual([]);
  });
});

// tests/unit/models/SearchHistory.test.ts
describe('SearchHistory', () => {
  test('should maintain max size limit', () => {
    const history = new SearchHistory([], 2);
    const result = history.add('first').add('second').add('third');
    
    expect(result.toArray()).toEqual(['second', 'third']);
  });
  
  test('should remove duplicates', () => {
    const history = new SearchHistory();
    const result = history.add('test').add('other').add('test');
    
    expect(result.toArray()).toEqual(['other', 'test']);
  });
});
```

### 10. Performance Optimizations ⭐️

**Current Issues**:
- Sequential file processing instead of parallel batching (`textSearchService.ts:165-181`)
- Webview recreates entire HTML on configuration changes
- No result virtualization for large result sets

**Solutions**:

```typescript
// Improved parallel processing in SearchService
private async processInBatches<T, R>(
  items: T[], 
  concurrency: number, 
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map(processor);
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

async searchInFolder(folderPath: string, pattern: string): Promise<SearchResult[]> {
  const files = await this.discoverFiles(folderPath);
  const results = await this.processInBatches(
    files, 
    5, // Process 5 files concurrently
    (file) => this.searchInFile(file, pattern)
  );
  
  return results.flat().slice(0, this.defaultOptions.maxResults);
}

// Incremental webview updates instead of full HTML recreation
private updateWebviewConfig(config: Partial<TextSearchConfig>): void {
  this.panel.webview.postMessage({
    command: 'updateConfig',
    config: config
  });
  // Don't recreate entire HTML, just update the configuration
}
```

## Implementation Priority

1. **High Priority** ⭐️⭐️⭐️
   - Constants extraction (#1) - Low risk, high impact
   - Dependency injection (#4) - Enables other improvements  
   - Business logic extraction (#6) - Reduces complexity

2. **Medium Priority** ⭐️⭐️
   - Error handling (#2) - Improves user experience
   - File system abstraction (#3) - Enables testing
   - Domain models (#5) - Improves code clarity
   - TypeScript strict mode (#7) - Improves type safety
   - Logging service (#8) - Improves debugging

3. **Lower Priority** ⭐️
   - Integration tests (#9) - Important but time-intensive
   - Performance optimizations (#10) - Current performance is acceptable

## Migration Strategy

1. **Phase 1**: Extract constants and improve error handling (low risk)
2. **Phase 2**: Implement file system abstraction and dependency injection
3. **Phase 3**: Create domain models and extract business logic
4. **Phase 4**: Add comprehensive testing and performance improvements

Each phase can be implemented incrementally without breaking existing functionality, allowing for gradual improvement of the codebase maintainability.