# QuickFind Roadmap

## 🚀 Phase 1: Essential Search Features

_Quick wins_

- [x] **Case sensitive toggle** - Button in search UI for case-sensitive matching
- [x] **Whole word match** - Option to match complete words only (`\b` boundaries)
- [x] **Search result count** - Display "X results in Y files" in status/header
- [x] **Search history** - Dropdown with last 20 searches, persist across sessions
  - Auto-select last search on panel open
  - Clear history option

## 🎨 Phase 2: Customization

_Better user control_

- [x] **Accent color config** - Theme matching for highlights
- [ ] **Include/exclude patterns UI** - Visual pattern builder
  - Quick toggles for common exclusions (node_modules, .git, etc.)
  - Save pattern presets

## 🔧 Phase 3: Smart Filtering

_Respect project conventions_

- [ ] **Honor .gitignore/.ignore files** - Parse and apply ignore patterns
  - Config option to enable/disable
  - Show indicator when patterns are active
- [ ] **File type filters** - Quick filters by extension/language
  - "Search only in: JS/TS/Python/etc."

## 🎯 Phase 4: Advanced Features

_Power user tools_

- [ ] **Symbol search** - Search functions/classes/variables
  - Use VSCode's symbol provider API
  - Fuzzy match on symbol names
  - Group by symbol type
- [ ] **Symbol filtering config** - Whitelist/blacklist symbol types

## 🔀 Phase 5: Layout Options

_Flexible viewing preferences_

- [ ] **Horizontal split view** - Toggle between vertical/horizontal split
  - Remember user preference per workspace
  - Keyboard shortcut for quick toggle
  - Adaptive layout based on window size
- [ ] **Adjustable split ratio** - Drag to resize panels
- [ ] **Full-screen result view** - Maximize results panel temporarily

## 🚧 Technical Debt

- [ ] **Unified UI architecture** - File search and text search share same components
  - Extract common webview components
  - Consistent styling and behavior
  - Shared configuration handling
- [ ] **Test coverage** - Comprehensive test suite
  - Unit tests for search algorithms
  - Integration tests for VSCode API
- [ ] **Performance monitoring** - Benchmarks and metrics
  - Search speed regression tests
  - Memory usage profiling
  - Large repository stress tests
- [ ] **Accessibility** - Full keyboard navigation and screen reader support
  - Focus management
  - High contrast theme support
