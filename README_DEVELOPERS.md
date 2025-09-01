# VSCode Regex Search Telescope Extension - Developer Documentation

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
