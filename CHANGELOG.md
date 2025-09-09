# Changelog

All notable changes to the "QuickFind" extension will be documented in this file.

The format is based (mostly) on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.8] - 2024-09-09

### Added

- Added prominent "×" close button to both file search and text search interfaces
- Performance optimization of the search result display
- Optional search view maximization setting for Telescope-style full-screen searching
- Vertical split layout option with context panel on right side when maximization is enabled
- Performance optimization with scroll debounce for context loading during rapid navigation
- Improve file search with hybrid regex/fuzzy search, remove confusing regex char highlighting

### Fixed

- Refocus to search-bar when using `aA` or `W` buttons during text search

## [0.7.1] - 2024-09-05

### Added

- Configurable accent color setting for search box border and selected result highlight
- Result count with limit indicators (shows "100+" when search limits are reached)
- Clear search history command accessible via Command Palette
- Search history with configurable keyboard navigation (Ctrl+Up/Down)
- Case-sensitive and whole-word search toggle buttons with persistent configuration
- Enhanced selected item visual feedback with neon green borders and improved keybinds visibility

### Fixed

- History navigation now automatically triggers search and skips duplicate current search

## [0.6.1] - 2024-09-03

### Changed

- Extension rebranded to "QuickFind"

### Fixed

- File opening in the wrong split

## [0.5.0] - 2024-09-03

### Added

- File search with Fuse.js

## [0.4.4] - 2024-09-03

### Added

- Changed ripgrep to native js search
- More compact search result view

### Fixed

- Removed assets from extension
- Sizing of context pannel
- Keybinding not working on windows
- File navigation when searching in folder

## [0.3.4] - 2024-09-02

### Added

- Changelog and improved documentation
- Close the search view when out of focus
- Code indentation preservation in context panel
- Dynamic context panel height based on context size setting
- Real-time configuration updates for context size
- Configurable context size setting
- Improved context display
- Windows and Mac compatibility

### Fixed

- Scrolling issues
- Refactor of the repo (html/css/js structure)

## [0.2.0] - 2024-09-01

### Added

- Initial telescope-like search interface
- Split-pane view with context panel
- Regex search capabilities
- Search results lazy loading

## [0.1.0] - 2024-08-31

### Added

- Basic search functionality
- File and folder search modes
