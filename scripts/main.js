// =============================================================
//  main.js
//
//  The entry point and "glue" of the application.
//  This file owns three things:
//
//    1. STATE  — the single source of truth for the whole app.
//               Every other file reads from this object.
//
//    2. DOM    — one place where we grab all the elements we
//               need. Avoids getElementById scattered everywhere.
//
//    3. EVENTS — all click/input/change listeners live here.
//               They update state and call functions from the
//               other files.
//
//    4. URL SYNC — encode state into the URL so the page can
//               be bookmarked and shared.
//
//    5. FETCH + INIT — load the data and kick everything off.
//
//  Load order in index.html (each file depends on the ones above it):
//    helpers.js  →  filter.js  →  render.js  →  modal.js  →  main.js
// =============================================================

const DATA_URL =
  "https://rawcdn.githack.com/akabab/superhero-api/0.2.0/api/all.json";

// =============================================================
//  STATE
//  One plain object. When you want to know "what is the app
//  currently doing?", this object has the answer.
//
//  Rules:
//  - Never write to state from inside an HTML template string.
//  - Always call applyFiltersAndSort() (or renderTable() for
//    page-only changes) after mutating state.
// =============================================================
const state = {
  heroes: [], // full dataset — never filtered, never sorted
  filtered: [], // current result after filter + sort
  sortColumn: "name", // which column the table is sorted by
  sortDirection: "asc", // "asc" or "desc"
  pageSize: 20, // number of rows per page (or "all")
  currentPage: 1,
  searchQuery: "",
  searchField: "name", // which column(s) to search
  searchOperator: "include", // how to match (include/exclude/fuzzy/=/≠/>/<)
  alignmentFilter: "all", // "all", "good", "bad", or "neutral"
  openHeroId: null, // id of the hero whose modal is open
};

// =============================================================
//  DOM REFERENCES
//  Grabbed once at startup. Using a single object makes it
//  obvious which elements the JS touches.
// =============================================================
const dom = {
  tbody: document.getElementById("tbody"),
  pagination: document.getElementById("pag"),
  searchInput: document.getElementById("sinp"),
  searchClear: document.getElementById("scl"),
  searchField: document.getElementById("sfield"),
  searchOp: document.getElementById("sop"),
  pageSize: document.getElementById("psz"),
  resultCount: document.getElementById("rc"),
  modal: document.getElementById("mo"),
  modalBody: document.getElementById("mc"),
  modalClose: document.getElementById("mcl"),
  headerTotal: document.getElementById("htotal"),
  headerGood: document.getElementById("hgood"),
  headerBad: document.getElementById("hbad"),
};

// =============================================================
//  URL SYNC
//
//  We encode the current state into the URL's query string
//  (e.g. ?q=batman&sort=strength&dir=desc) using history.replaceState.
//  This means:
//    - The browser's back button works as expected.
//    - Users can copy the URL and share an exact view.
//    - Refreshing the page restores the same state.
//
//  We only write params that differ from the default so the
//  URL stays short when nothing special is set.
// =============================================================
function syncStateToURL() {
  const params = new URLSearchParams();

  if (state.searchQuery) params.set("q", state.searchQuery);
  if (state.searchField !== "name") params.set("field", state.searchField);
  if (state.searchOperator !== "include")
    params.set("op", state.searchOperator);
  if (state.alignmentFilter !== "all")
    params.set("align", state.alignmentFilter);
  if (state.pageSize !== 20) params.set("pagesize", state.pageSize);
  if (state.currentPage !== 1) params.set("page", state.currentPage);
  if (state.sortColumn !== "name") params.set("sort", state.sortColumn);
  if (state.sortDirection !== "asc") params.set("dir", state.sortDirection);
  if (state.openHeroId) params.set("hero", state.openHeroId);

  const queryString = params.toString();
  history.replaceState(
    null,
    "",
    queryString ? `${location.pathname}?${queryString}` : location.pathname,
  );
}

// =============================================================
//  loadStateFromURL
//  Reads URL params back into state and syncs the UI controls
//  to match. Called once on startup, before the fetch.
// =============================================================
function loadStateFromURL() {
  const params = new URLSearchParams(location.search);

  if (params.has("q")) {
    state.searchQuery = params.get("q");
    dom.searchInput.value = state.searchQuery;
  }
  if (params.has("field")) {
    state.searchField = params.get("field");
    dom.searchField.value = state.searchField;
  }
  if (params.has("op")) {
    state.searchOperator = params.get("op");
    dom.searchOp.value = state.searchOperator;
  }
  if (params.has("align")) {
    state.alignmentFilter = params.get("align");
    // Update the active button to match
    document
      .querySelectorAll(".filter-btn")
      .forEach((btn) =>
        btn.classList.toggle(
          "act",
          btn.dataset.align === state.alignmentFilter,
        ),
      );
  }
  if (params.has("pagesize")) {
    const raw = params.get("pagesize");
    state.pageSize = raw === "all" ? "all" : Number(raw);
    dom.pageSize.value = state.pageSize;
  }
  if (params.has("page")) state.currentPage = Number(params.get("page"));
  if (params.has("sort")) state.sortColumn = params.get("sort");
  if (params.has("dir")) state.sortDirection = params.get("dir");

  // Reflect sort state in the header indicators
  updateSortHeaders();

  // Show the clear (×) button if there's already a search query
  if (state.searchQuery) dom.searchClear.classList.add("v");
}

// =============================================================
//  EVENT LISTENERS
//  Each listener follows the same pattern:
//    1. Read the new value from the event / element
//    2. Write it into state
//    3. Call the appropriate render function
//    4. Sync the URL
// =============================================================

// ── Sort: clicking a column header ───────────────────────────
document.querySelector("#tbl thead").addEventListener("click", (event) => {
  // Walk up from whatever was clicked to find the <th>
  const th = event.target.closest("th[data-col]");
  if (!th || th.dataset.col === "icon") return; // icon column is not sortable

  const column = th.dataset.col;

  if (column === state.sortColumn) {
    // Same column — toggle between ascending and descending
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    // New column — always start ascending
    state.sortColumn = column;
    state.sortDirection = "asc";
  }

  updateSortHeaders();
  applyFiltersAndSort();
  syncStateToURL();
});

// ── Row click → open the hero detail modal ───────────────────
dom.tbody.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;

  const hero = state.heroes.find((h) => h.id === Number(row.dataset.id));
  if (hero) openModal(hero);
});

// ── Search input (fires on every keystroke) ──────────────────
dom.searchInput.addEventListener("input", () => {
  state.searchQuery = dom.searchInput.value;
  // Show/hide the clear button
  dom.searchClear.classList.toggle("v", state.searchQuery.length > 0);
  applyFiltersAndSort();
  syncStateToURL();
});

// ── Field selector (which column to search) ──────────────────
dom.searchField.addEventListener("change", () => {
  state.searchField = dom.searchField.value;
  applyFiltersAndSort();
  syncStateToURL();
});

// ── Operator selector (include / exclude / fuzzy / = / …) ────
dom.searchOp.addEventListener("change", () => {
  state.searchOperator = dom.searchOp.value;
  applyFiltersAndSort();
  syncStateToURL();
});

// ── Clear search button (the × inside the input) ─────────────
dom.searchClear.addEventListener("click", () => {
  dom.searchInput.value = "";
  state.searchQuery = "";
  dom.searchClear.classList.remove("v");
  applyFiltersAndSort();
  syncStateToURL();
});

// ── Alignment filter buttons (ALL / GOOD / BAD / NEUTRAL) ────
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("act"));
    btn.classList.add("act");
    state.alignmentFilter = btn.dataset.align;
    applyFiltersAndSort();
    syncStateToURL();
  });
});

// ── Page size selector ────────────────────────────────────────
dom.pageSize.addEventListener("change", () => {
  state.pageSize =
    dom.pageSize.value === "all" ? "all" : Number(dom.pageSize.value);
  state.currentPage = 1;
  renderTable();
  renderPagination();
  syncStateToURL();
});

// ── Pagination button clicks (Prev / 1 / 2 / … / Next) ───────
// We listen on the container instead of each button because the
// buttons are re-created every render (event delegation pattern).
dom.pagination.addEventListener("click", (event) => {
  const btn = event.target.closest(".page-btn[data-page]");
  if (!btn || btn.disabled) return;

  const totalPages = Math.ceil(state.filtered.length / state.pageSize);
  const targetPage = Number(btn.dataset.page);
  if (targetPage < 1 || targetPage > totalPages) return;

  state.currentPage = targetPage;
  renderTable();
  renderPagination();
  syncStateToURL();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ── Modal: close button ───────────────────────────────────────
dom.modalClose.addEventListener("click", closeModal);

// ── Modal: click on the dark backdrop ────────────────────────
dom.modal.addEventListener("click", (event) => {
  // Only close if the click was on the overlay itself,
  // not on the modal-content box inside it
  if (event.target === dom.modal) closeModal();
});

// ── Modal: Escape key ─────────────────────────────────────────
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && dom.modal.classList.contains("open"))
    closeModal();
});

// =============================================================
//  FETCH + INIT
//  This is where execution really begins.
//
//  Order of operations:
//    1. loadStateFromURL — set state from URL before any render
//    2. fetch()          — download the data
//    3. applyFiltersAndSort() — first render with real data
//    4. Open hero modal if URL contained ?hero=...
// =============================================================
loadStateFromURL();

fetch(DATA_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((heroes) => {
    // Store the full dataset — applyFiltersAndSort reads from here
    state.heroes = heroes;

    // Fill the header stat counters
    dom.headerTotal.textContent = heroes.length;
    dom.headerGood.textContent = heroes.filter(
      (h) => h.biography.alignment === "good",
    ).length;
    dom.headerBad.textContent = heroes.filter(
      (h) => h.biography.alignment === "bad",
    ).length;

    // Run the full pipeline for the first time
    applyFiltersAndSort();

    // If the URL contained ?hero=287, open that hero's modal
    const heroIdFromURL = new URLSearchParams(location.search).get("hero");
    if (heroIdFromURL) {
      const hero = state.heroes.find((h) => h.id === Number(heroIdFromURL));
      // Small timeout so the table has rendered before we scroll to the row
      if (hero) setTimeout(() => openModal(hero), 80);
    }
  })
  .catch(() => showError());
