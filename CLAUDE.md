# VSCode Fuzzy Search Telescope Extension

## Requirements

This VSCode plugin provides fuzzy text search functionality similar to vim telescope with the following features:

### Core Features
1. **Two Search Modes:**
   - Search in current file only
   - Search in current folder/workspace

2. **Split-Pane Interface:**
   - Top half: List of matching lines with fuzzy highlighting
   - Bottom half: Code context surrounding the selected line
   - Similar to vim telescope interface

3. **Navigation:**
   - ESC: Exit search view and return to original file
   - Enter: Navigate to selected line and column
   - Arrow keys for result selection
   - Auto-focus on search input

4. **Integration:**
   - Uses system `ripgrep` (rg) for fast text searching
   - Advanced fuzzy matching with word boundary prioritization
   - Real-time filtering as you type

### Keybindings
- `Ctrl+Shift+F` (Cmd+Shift+F on Mac): Search in current file
- `Ctrl+Shift+P` (Cmd+Shift+P on Mac): Search in current folder

## Implementation Status

### ✅ Completed Features
1. **Project Setup & Architecture**
   - VSCode extension scaffolding with TypeScript
   - Modular architecture with separate concerns
   - Build system and linting configuration

2. **Core Functionality**
   - Extension activation and command registration
   - Ripgrep integration for text searching
   - Advanced fuzzy matching algorithm with backtracking
   - Custom webview for split-pane search interface
   - Search in current file and folder/workspace
   - Navigation logic (ESC/Enter/Arrow keys)
   - Command palette entries and keybindings

3. **User Experience Improvements**
   - Auto-focus on search input when extension opens
   - Intelligent fuzzy matching that prioritizes:
     - Word boundaries (e.g., "Err" in "ErrInvalidInput")
     - Consecutive character matches
     - CamelCase boundaries
     - Early position in text
   - Real-time highlighting of matched characters
   - Context display for selected results

## Installation & Testing

### Development Mode (Recommended for Testing)
1. Open the extension folder in VSCode:
   ```bash
   code /home/mclement/git/dataservice_integration_test/vscode-fuzzy-search
   ```
2. Press `F5` to launch Extension Development Host
3. In the new VSCode window, test with `Ctrl+Shift+F` or `Ctrl+Shift+P`

### Package and Install
```bash
# Install packaging tool
npm install -g vsce

# Package the extension
vsce package

# Install the .vsix file
code --install-extension fuzzy-search-telescope-0.0.1.vsix
```

## Architecture

### Core Components
1. **extension.ts** - Main extension entry point with command registration
2. **fuzzySearchProvider.ts** - Core search orchestration logic
3. **ripgrepService.ts** - Integration with system ripgrep for text searching
4. **fuzzyMatcher.ts** - Advanced fuzzy matching with backtracking algorithm
5. **searchWebviewPanel.ts** - Custom webview for split-pane search interface

### System Requirements
- **ripgrep** (rg) - Fast text search engine (installed at `/usr/bin/rg`)
- **VSCode** version ^1.74.0
- **Node.js** and **TypeScript** for development

## Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes during development  
npm run watch

# Run linting
npm run lint

# Test the extension
F5 in VSCode to launch Extension Development Host
```

## File Structure
```
vscode-fuzzy-search/
├── package.json              # Extension manifest and dependencies
├── tsconfig.json             # TypeScript configuration
├── .eslintrc.json           # ESLint configuration
├── .vscode/
│   └── launch.json          # Debug configuration
├── src/
│   ├── extension.ts         # Main extension entry point
│   ├── fuzzySearchProvider.ts # Core search orchestration
│   ├── ripgrepService.ts    # Ripgrep integration with context
│   ├── fuzzyMatcher.ts      # Advanced fuzzy matching algorithm
│   └── searchWebviewPanel.ts # Custom webview UI with split panes
├── out/                     # Compiled JavaScript output
└── CLAUDE.md               # This documentation
```

## Technical Implementation

### Fuzzy Matching Algorithm
- **Backtracking search** to find optimal character matches
- **Word boundary prioritization** - matches at start of words score higher
- **Consecutive match bonuses** - "err" matches preferred over "e..r..r"
- **CamelCase boundary detection** - matches at capital letters get bonus
- **Gap penalties** - large gaps between matches reduce score

### Search Performance
- **Ripgrep integration** for fast text searching with context lines
- **Real-time filtering** as user types with minimal latency
- **Incremental results** - search updates immediately on input change

### User Interface
- **Split-pane webview** - results list on top, context on bottom
- **Keyboard navigation** - full arrow key and Enter/ESC support
- **Auto-focus** - search input automatically focused on open
- **Syntax highlighting** - matched characters highlighted in results

## Usage Tips

- Type any part of the text you're looking for - doesn't need to be exact
- Use abbreviations like "ErrInv" to find "ErrInvalidInput" 
- Search works across filename and line content simultaneously
- Navigate with arrow keys, Enter to jump to location, ESC to cancel