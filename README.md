# QuickFind - VSCode Extension

<div align="center">
  <img src="assets/images/quickfind-logo.jpeg" alt="QuickFind Logo" width="128" height="128">
</div>

A fast and intuitive search extension for Visual Studio Code, inspired by vim telescope.
Provides powerful text search and file search capabilities with a clean split-pane interface.

QuickFind creates dedicated webview panels that provide a more user-friendly and immersive search experience with better context visualization.

## Preview

### Demo

Text search, workspace grep, file search, and layout options:

![QuickFind Demo - Text search, workspace grep, file search, and layout options](https://raw.githubusercontent.com/pseudoincorrect/vscode-quickfind/main/assets/images/quickfind-demo.gif)

### File Search

![File Search Demo - Fuzzy file search with file metadata and content preview](https://raw.githubusercontent.com/pseudoincorrect/vscode-quickfind/main/assets/images/file-search.jpeg)

### Maximized Layout (Default)

Maximizes the search panel to use the full screen space with the context panel positioned on the right for optimal code viewing.

![Maximised Layout Demo - Context panel positioned on the right for better code viewing in maximized mode](https://raw.githubusercontent.com/pseudoincorrect/vscode-quickfind/main/assets/images/maximised-layout.jpeg)

### Compact Layout

Keeps the search panel contained within the current editor with the context panel positioned on top for a smaller footprint. Enable via VSCode settings.

![Compact Layout Demo - Context panel positioned on top for a smaller footpring](https://raw.githubusercontent.com/pseudoincorrect/vscode-quickfind/main/assets/images/compact-layout.jpeg)

## Functions

### 🔍 Search Current File

**Keybinding**: `Ctrl+T` (Windows/Linux) / `Cmd+T` (macOS)  
*Remember: **T**ext search in file*

Search within the currently active file with real-time regex matching and highlighting. Features toggle buttons for case-sensitive and whole-word search options.

### 🔍 Search Workspace

**Keybinding**: `Ctrl+G` (Windows/Linux) / `Cmd+G` (macOS)  
*Remember: **G**rep workspace*

Search across all files in your workspace with blazing-fast performance. Features toggle buttons for case-sensitive and whole-word search options.

### 📁 Search Files

**Keybinding**: `Ctrl+R` (Windows/Linux) / `Cmd+R` (macOS)  
*Remember: **R**each for files*

Fuzzy search for files in your workspace. Find files by name with intelligent matching and see file metadata in the context panel.

## 🎛️ Search Options

Toggle buttons for advanced search options:

- **Case-Sensitive** (`Aa` button) and **Whole-Word** (`W` button) matching
- **Persistent Settings**: Preferences automatically saved and remembered across sessions
- **Real-time Updates** with visual feedback (muted/highlighted states)

## ⏳ Search History

Automatic search history with smart defaults:

- **Auto-saved**: Every search saved, most recent pre-filled on open
- **Navigation**: `Ctrl+Up/Down` (Windows/Linux) or `Cmd+Up/Down` (macOS) to browse history
- **Management**: Clear via Command Palette → "QuickFind: Clear Search History"
- **Storage**: Limited to 50 entries, saved in `/tmp/vscode-quickfind-text-search-history.json`

## Configuration

- **`quickFind.contextSize`** (default: 7): Lines of context around search results (0-20)
- **`quickFind.accentColor`** (default: "#00ff88"): Hex color for search UI highlights
- **`quickFind.maxFileSize`** (default: "1MB"): Maximum file size for searches (supports KB, MB, GB)
- **`quickFind.maxResults`** (default: 1000): Maximum number of results (1-10000)
- **`quickFind.maximizedLayout`** (default: true): Auto-maximize search panel for full screen space and enable vertical split layout (context panel on right side instead of top)

## Requirements

- **VSCode**: Version 1.74.0 or higher

## Keyboard Shortcuts

Customize via **Keyboard Shortcuts** (`Ctrl+K Ctrl+S` / `Cmd+K Cmd+S`):

- **Search in Current File**: `Ctrl+T` / `Cmd+T`
- **Search in Workspace**: `Ctrl+G` / `Cmd+G`
- **Search Files**: `Ctrl+R` / `Cmd+R`
- **History Navigation**: `Ctrl+Up/Down` / `Cmd+Up/Down`
- **Clear History**: Available in Command Palette

---

For installation instructions, changelog, detailed usage, development setup, releases, and contribution guidelines, see [README_DEVELOPERS.md](README_DEVELOPERS.md).
