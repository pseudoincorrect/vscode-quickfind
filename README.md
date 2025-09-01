# VSCode Regex Search Telescope Extension

<div align="center">
  <img src="assets/images/telescope-regex.png" alt="Regex Search Telescope Logo" width="128" height="128">
</div>

A fast and intuitive regex search extension for Visual Studio Code, inspired by vim telescope. Provides powerful text search capabilities with a clean split-pane interface.

## Features

### 🔍 Dual Search Modes
- **Current File Search** (`Ctrl+Shift+F` / `Cmd+Shift+F`): Search within the active file
- **Workspace Search** (`Ctrl+Shift+P` / `Cmd+Shift+P`): Search across all files in the workspace

### ⚡ Advanced Regex Matching
- Smart word boundary prioritization (e.g., "Err" matches "ErrInvalidInput")
- CamelCase-aware matching for better code navigation
- Real-time highlighting of matched characters
- Backtracking algorithm for optimal match scoring

### 🖥️ Split-Pane Interface
- **Top pane**: List of matching lines with regex highlighting
- **Bottom pane**: Code context surrounding the selected line
- Familiar vim telescope-style navigation

### 🚀 Performance
- Built on `ripgrep` for blazing-fast text search
- Incremental search results as you type
- Optimized for large codebases

## Preview

![Search View](assets/images/search_view.png)

## Installation

### From VSIX (Recommended)
1. Download the latest `.vsix` file from the [releases folder](releases/)
2. Install via command line:
   ```bash
   code --install-extension vscode-regex-search-telescope-0.0.1.vsix
   ```
3. Or install through VSCode: `Ctrl+Shift+P` → "Extensions: Install from VSIX"

### Development Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd vscode-regex-search
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Press `F5` in VSCode to launch Extension Development Host

## Usage

### Keybindings
| Command | Windows/Linux | macOS | Description |
|---------|---------------|-------|-------------|
| Search Current File | `Ctrl+Shift+F` | `Cmd+Shift+F` | Search within active file |
| Search Workspace | `Ctrl+Shift+P` | `Cmd+Shift+P` | Search all files in workspace |

### Navigation
- **Arrow Keys**: Navigate between search results
- **Enter**: Jump to selected line and column
- **Escape**: Close search and return to original file
- **Type**: Filter results in real-time

### Search Tips
- Use abbreviations: `ErrInv` → `ErrInvalidInput`
- Partial matches work: `userAuth` → `getUserAuthentication`
- Case-insensitive by default
- Search across both filenames and content

## Requirements

- **VSCode**: Version 1.74.0 or higher
- **ripgrep**: Must be installed and available in system PATH

### Installing ripgrep

This extension depends on `ripgrep` for fast text searching. Please install it for your platform:

#### Windows
- **Using winget**: `winget install BurntSushi.ripgrep.MSVC`
- **Using Chocolatey**: `choco install ripgrep`
- **Using Scoop**: `scoop install ripgrep`
- **Manual**: Download from [ripgrep releases](https://github.com/BurntSushi/ripgrep/releases)

#### macOS
- **Using Homebrew**: `brew install ripgrep`
- **Using MacPorts**: `sudo port install ripgrep`
- **Manual**: Download from [ripgrep releases](https://github.com/BurntSushi/ripgrep/releases)

#### Linux
- **Ubuntu/Debian**: `sudo apt install ripgrep`
- **Fedora/RHEL**: `sudo dnf install ripgrep` or `sudo yum install ripgrep`
- **Arch Linux**: `sudo pacman -S ripgrep`
- **Alpine**: `apk add ripgrep`
- **Snap**: `sudo snap install ripgrep --classic`
- **Manual**: Download from [ripgrep releases](https://github.com/BurntSushi/ripgrep/releases)

> **Note**: The extension automatically detects the ripgrep installation path on Windows, macOS, and Linux. If ripgrep is not found, you'll see installation instructions.

## Development

### Building
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run linting
npm run lint
```

### Testing
1. Open the project in VSCode
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new VSCode window

### Packaging
```bash
# Install VSCE
npm install -g vsce

# Package extension
vsce package
```

## Architecture

```
src/
├── extension.ts              # Main extension entry point
├── regexSearchProvider.ts    # Core search orchestration
├── ripgrepService.ts         # Ripgrep integration
├── regexMatcher.ts          # Advanced regex matching algorithm
└── searchWebviewPanel.ts    # Split-pane webview interface
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Inspired by [vim telescope](https://github.com/nvim-telescope/telescope.nvim)
- Powered by [ripgrep](https://github.com/BurntSushi/ripgrep) for fast text search
