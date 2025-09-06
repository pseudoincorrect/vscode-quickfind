# Changelog

All notable changes to the "QuickFind" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Optional search view maximization setting for Telescope-style full-screen searching
- Vertical split layout option with context panel on right side when maximization is enabled
- Performance optimization with scroll debounce for context loading during rapid navigation

## [0.7.1] - 2024-09-05

### Added
- Configurable accent color setting for search box border and selected result highlight
- Result count with limit indicators (shows "100+" when search limits are reached)
- Clear search history command accessible via Command Palette

## [0.7.0] - 2024-09-05

### Added
- Search history with configurable keyboard navigation (Ctrl+Up/Down)
- Case-sensitive and whole-word search toggle buttons with persistent configuration
- Enhanced selected item visual feedback with neon green borders and improved keybinds visibility

### Fixed
- History navigation now automatically triggers search and skips duplicate current search

## [0.6.1] - 2024-09-03

### Fix
- File opening in the wrong split

## [0.6.0] - 2024-09-03

### Changed
- Extension rebranded to "QuickFind"

### Added

## [0.5.0] - 2024-09-03

### Added
- Search Files

### Fix
- Removed assets from extension
- Sizing of context pannel

## [0.4.3] - 2024-09-03

### Added
- More compact search result view

## [0.4.2] - 2024-09-02

### Fixed
- Keybinding not working on windows

## [0.4.1] - 2024-09-02

### Fixed
- File navigation when searching in folder

## [0.4.0] - 2024-09-02

### Added
- Changed ripgrep to native js search

## [0.3.3] - 2024-09-02

### Added
- Changelog and improved documentation

## [0.3.2] - 2024-09-02

### Added
- Close the search view when out of focus
- Code indentation preservation in context panel

## [0.3.1] - 2024-09-01

### Added
- Dynamic context panel height based on context size setting
- Real-time configuration updates for context size

## [0.3.0] - 2024-09-01

### Added
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
