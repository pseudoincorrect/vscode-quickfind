# Changelog

All notable changes to the "QuickFind" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Extension rebranded to "QuickFind" for better discoverability
- Updated name, description, and command titles
- Added keywords for telescope, search, fuzzy, regex searches
- **BREAKING**: Command names changed from `regexSearch.*` to `quickFind.*`
- **BREAKING**: Configuration settings changed from `regexSearch.*` to `quickFind.*`

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
