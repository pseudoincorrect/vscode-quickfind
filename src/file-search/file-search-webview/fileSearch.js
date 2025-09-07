const vscode = acquireVsCodeApi();
let results = [];
let selectedIndex = 0;
let searchTimeout = null;
let contextLoadTimeout = null;
let currentSearchQuery = "";
let workspacePath = "";
let displayedResults = 50; // Initially show only 50 results
const INITIAL_BATCH_SIZE = 50;
const LOAD_MORE_BATCH_SIZE = 25;
const CONTEXT_LOAD_DEBOUNCE_MS = 100;

const searchInput = document.querySelector(".search-input");
const resultsList = document.getElementById("resultsList");
const contextPanel = document.getElementById("contextPanel");

// Initialize with initial data (will be set by the HTML template)
if (typeof initialData !== "undefined") {
  results = initialData.results || [];
  currentSearchQuery = initialData.searchQuery || "";
  workspacePath = initialData.workspacePath || "";
}

// Apply layout class based on maximizedLayout config
const container = document.getElementById("container");
if (typeof isVerticalLayout !== "undefined" && isVerticalLayout) {
  container.classList.add("vertical-layout");
} else {
  container.classList.add("horizontal-layout");
}

updateDisplay();

searchInput.addEventListener("input", (e) => {
  const query = e.target.value;

  // Clear existing timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  // For file searches, use minimal debounce for responsive fuzzy search
  searchTimeout = setTimeout(() => {
    vscode.postMessage({ command: "search", query: query });
  }, 100);
});

searchInput.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "Escape":
      e.preventDefault();
      vscode.postMessage({ command: "cancel" });
      break;
    case "Enter":
      e.preventDefault();
      if (results.length > 0) {
        vscode.postMessage({ command: "select", index: selectedIndex });
      }
      break;
    case "ArrowDown":
      e.preventDefault();
      if (selectedIndex < results.length - 1) {
        selectedIndex++;
        // Auto-load more results if we're near the end
        if (
          selectedIndex >= displayedResults - 5 &&
          displayedResults < results.length
        ) {
          displayedResults = Math.min(
            displayedResults + LOAD_MORE_BATCH_SIZE,
            results.length,
          );
        }
        updateSelection();
      }
      break;
    case "ArrowUp":
      e.preventDefault();
      if (selectedIndex > 0) {
        selectedIndex--;
        updateSelection();
      }
      break;
  }
});

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.command === "updateResults") {
    results = message.results;
    currentSearchQuery = message.searchQuery || "";
    workspacePath = message.workspacePath || "";
    selectedIndex = 0;
    displayedResults = INITIAL_BATCH_SIZE; // Reset to initial batch size
    updateDisplay();
  } else if (message.command === "updateContext") {
    // Handle context update for a specific result
    const { index, context } = message;
    if (results[index]) {
      results[index].context = context;
      updateContext();
    }
  } else if (message.command === "focus") {
    searchInput.focus();
  }
});

function loadMoreResults() {
  displayedResults = Math.min(
    displayedResults + LOAD_MORE_BATCH_SIZE,
    results.length,
  );
  updateResultsList();
}

function updateDisplay() {
  updateResultsList();
  updateContext();
}

function updateResultsList() {
  if (results.length === 0) {
    resultsList.innerHTML = '<div class="no-results">No files found</div>';
    return;
  }

  // Limit displayed results for performance
  const resultsToShow = Math.min(displayedResults, results.length);
  const hasMore = results.length > displayedResults;

  let html = results
    .slice(0, resultsToShow)
    .map((result, index) => {
      const relativePath = getRelativePath(result.file, workspacePath);
      const fileName = result.name;
      const highlightedName = highlightSearchTerm(
        escapeHtml(fileName),
        currentSearchQuery,
      );
      const highlightedPath = highlightSearchTerm(
        escapeHtml(relativePath),
        currentSearchQuery,
      );

      return `<div class="result-item ${index === selectedIndex ? "selected" : ""}" 
                    onclick="navigateToResult(${index})">
            <div class="file-info">
                <div class="file-name">${highlightedName}</div>
                <div class="file-path-display">${highlightedPath}</div>
            </div>
        </div>`;
    })
    .join("");

  // Add load more button if there are more results
  if (hasMore) {
    const remaining = results.length - displayedResults;
    html += `<div class="load-more-container">
            <button class="load-more-btn" onclick="loadMoreResults()">
                Load ${Math.min(LOAD_MORE_BATCH_SIZE, remaining)} more files (${remaining} remaining)
            </button>
        </div>`;
  }

  resultsList.innerHTML = html;
}

function updateContext() {
  if (results.length === 0 || !results[selectedIndex]) {
    contextPanel.innerHTML =
      '<div class="no-selection">Select a file to see context</div>';
    return;
  }

  const result = results[selectedIndex];

  // If context hasn't been loaded yet, request it with debouncing
  if (!result.context) {
    contextPanel.innerHTML =
      '<div class="context-loading">Loading file context...</div>';
    requestContextLoad(selectedIndex);
    return;
  }

  if (result.context.length === 0) {
    contextPanel.innerHTML =
      '<div class="no-context">No content to display</div>';
    return;
  }

  let contextHtml = "";
  result.context.forEach((line, index) => {
    const escapedLine = escapeHtml(line);
    contextHtml += `<div class="context-line">${escapedLine}</div>`;
  });

  contextPanel.innerHTML = contextHtml;
}

function requestContextLoad(index) {
  // Clear existing timeout to reset the debounce
  if (contextLoadTimeout) {
    clearTimeout(contextLoadTimeout);
  }

  // Set new timeout for debounced context loading
  contextLoadTimeout = setTimeout(() => {
    const result = results[index];
    if (result && !result.contextRequested) {
      result.contextRequested = true;
      vscode.postMessage({ command: "loadContext", index: index });
    }
  }, CONTEXT_LOAD_DEBOUNCE_MS);
}

function selectResult(index) {
  selectedIndex = index;
  updateSelection();
}

function navigateToResult(index) {
  selectedIndex = index;
  updateSelection();
  vscode.postMessage({ command: "select", index: index });
}

function updateSelection() {
  updateResultsList();
  updateContext();

  // Scroll selected item into view
  const selectedItem = document.querySelector(".result-item.selected");
  if (selectedItem) {
    selectedItem.scrollIntoView({
      behavior: "instant",
      block: "nearest",
      inline: "nearest",
    });
  }
}

function highlightSearchTerm(text, searchQuery) {
  if (!searchQuery || searchQuery.trim() === "") {
    return text;
  }

  // For fuzzy search highlighting, we'll do a simple case-insensitive search
  // This could be enhanced to match the actual fuzzy matching algorithm
  const lowerText = text.toLowerCase();
  const lowerQuery = searchQuery.toLowerCase();
  let result = "";
  let lastIndex = 0;

  // Split query into characters for fuzzy highlighting
  const queryChars = lowerQuery.split("");
  let textIndex = 0;
  let queryIndex = 0;

  while (textIndex < text.length && queryIndex < queryChars.length) {
    if (lowerText[textIndex] === queryChars[queryIndex]) {
      // Found a matching character
      result += text.substring(lastIndex, textIndex);
      result += '<span class="search-highlight">' + text[textIndex] + "</span>";
      lastIndex = textIndex + 1;
      queryIndex++;
    }
    textIndex++;
  }

  result += text.substring(lastIndex);
  return result;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getRelativePath(fullPath, workspacePath) {
  if (!workspacePath || !fullPath) {
    return fullPath;
  }

  // Normalize paths to use forward slashes
  const normalizedFullPath = fullPath.replace(/\\/g, "/");
  const normalizedWorkspacePath = workspacePath.replace(/\\/g, "/");

  // Ensure workspace path ends with slash for proper comparison
  const workspacePathWithSlash = normalizedWorkspacePath.endsWith("/")
    ? normalizedWorkspacePath
    : normalizedWorkspacePath + "/";

  if (normalizedFullPath.startsWith(workspacePathWithSlash)) {
    // Return relative path
    return normalizedFullPath.substring(workspacePathWithSlash.length);
  }

  // If not within workspace, return full path
  return normalizedFullPath;
}
