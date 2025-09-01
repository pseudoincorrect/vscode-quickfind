# VSCode Regex Search Telescope Extension

<div align="center">
  <img src="assets/images/regex-search-telescope-logo.png" alt="Regex Search Telescope Logo" width="128" height="128">
</div>

A fast and intuitive regex search extension for Visual Studio Code, inspired by vim telescope. Provides powerful text search capabilities with a clean split-pane interface.

## Preview

![Search View](assets/images/search_view.png)

## Functions

### 🔍 Search Current File
**Keybinding**: `Ctrl+Alt+F` (Windows/Linux) / `Cmd+Alt+F` (macOS)

Search within the currently active file with real-time regex matching and highlighting.

### 🔍 Search Workspace
**Keybinding**: `Ctrl+Alt+G` (Windows/Linux) / `Cmd+Alt+G` (macOS)

Search across all files in your workspace with blazing-fast performance powered by ripgrep.

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

## Customizing Keyboard Shortcuts

You can customize the keyboard shortcuts for this extension:

1. Open VS Code settings (`Ctrl+,` or `Cmd+,`)
2. Go to **Keyboard Shortcuts** (`Ctrl+K Ctrl+S` or `Cmd+K Cmd+S`)
3. Search for "Regex Search" to find the extension commands
4. Click the pencil icon next to any command to change its keybinding
5. Set your preferred key combination

**Available commands:**
- `Regex Search: Search in Current File` (default: `Ctrl+Alt+F` / `Cmd+Alt+F`)
- `Regex Search: Search in Current Folder` (default: `Ctrl+Alt+G` / `Cmd+Alt+G`)

---

For installation instructions, detailed usage, development setup, and contribution guidelines, see [README_DEVELOPERS.md](README_DEVELOPERS.md).
