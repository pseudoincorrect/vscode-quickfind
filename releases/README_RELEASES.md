# Releases

This folder contains packaged `.vsix` files for the VSCode Regex Search Telescope extension.
Releases are automatically generated using `npm run package` with versions matching package.json.

## Installation

To install a release:

1. Download the desired `.vsix` file
2. Install via command line:
   ```bash
   code --install-extension vscode-regex-search-telescope-[version].vsix
   ```
3. Or install through VSCode: `Ctrl+Shift+P` → "Extensions: Install from VSIX"

## Development Commands

- `npm run package` - Create a new release in this folder
- `npm run package-release` - Package with confirmation message
- `npm run install-extension` - Package and install the extension locally
- `npm run clean-releases` - Remove all .vsix files from this folder

## Changelog

See [CHANGELOG.md](../../CHANGELOG.md)