# VSCode Regex Search Telescope Extension - Developer Documentation


## Development Installation
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
| Search Current File | `Ctrl+Alt+F` | `Cmd+Alt+F` | Search within active file |
| Search Current Folder | `Ctrl+Alt+G` | `Cmd+Alt+G` | Search all files in current folder |

### Navigation
- **Arrow Keys**: Navigate between search results
- **Enter**: Jump to selected line and column
- **Escape**: Close search and return to original file
- **Type**: Filter results in real-time

## Development

### Building
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes during development
npm run watch

# Run linting
npm run lint

# Run tests
npm run test

# Package extension to releases folder
npm run package

# Package extension with release message
npm run package-release

# Install the extension directly
npm run install-extension

# Clean old .vsix files from releases folder
npm run clean-releases
```

### Testing
1. Open the project in VSCode
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new VSCode window

### Packaging
```bash
# Package extension (creates .vsix in releases folder)
npm run package

# Package with release message
npm run package-release

# Install packaged extension automatically
npm run install-extension

# Clean old releases
npm run clean-releases
```

## Architecture

```
src/
├── extension.ts              # Main extension entry point
├── searchProvider.ts         # Core search orchestration
├── searchService.ts          # Search service implementation
├── searchWebviewPanel.ts     # Split-pane webview interface
├── test/                     # Test files and data
│   ├── runTest.ts
│   ├── suite/
│   └── test_data/
└── webview/                  # Webview UI components
    ├── search.css
    ├── search.html
    └── search.js
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

## Changelog

See [CHANGELOG.md](CHANGELOG.md)

## Release process

See [README_RELEASES.md](releases/README_RELEASES.md)


## Acknowledgments

- Inspired by [vim telescope](https://github.com/nvim-telescope/telescope.nvim)
