// =============================================================
//  filter.js
//
//  Two responsibilities:
//    1. heroMatchesSearch — does a single hero pass the search?
//    2. applyFiltersAndSort — rebuild state.filtered from
//       state.heroes by running alignment filter → search → sort.
//
//  Depends on: helpers.js (getValue, NUMERIC_COLUMNS, fuzzyMatch)
//              state (defined in main.js, shared globally)
// =============================================================

// =============================================================
//  heroMatchesSearch
//
//  Returns true if `hero` passes the current search criteria.
//
//  Parameters:
//    hero     — one hero object from the API
//    query    — the string the user typed
//    field    — which column to search ("name", "race", "all", …)
//    operator — how to match ("include", "exclude", "fuzzy",
//               "equal", "not-equal", "gt", "lt")
// =============================================================
function heroMatchesSearch(hero, query, field, operator) {
  // Empty query → every hero passes
  if (!query) return true;

  const queryLower = query.toLowerCase();

  // ── Numeric operators (=, ≠, >, <) ─────────────────────────
  // These only make sense against numeric columns.
  if (["equal", "not-equal", "gt", "lt"].includes(operator)) {
    const queryNumber = parseFloat(query);

    // User typed something that isn't a number.
    // Only "not-equal" can sensibly match (everything ≠ NaN).
    if (isNaN(queryNumber)) return operator === "not-equal";

    // If a specific numeric field is selected, check only that.
    // Otherwise check all numeric columns.
    const columnsToCheck = NUMERIC_COLUMNS.has(field)
      ? [field]
      : Array.from(NUMERIC_COLUMNS);

    return columnsToCheck.some((col) => {
      const value = getValue(hero, col);

      // Missing values: only "not-equal" passes
      if (value === null) return operator === "not-equal";

      if (operator === "equal") return value === queryNumber;
      if (operator === "not-equal") return value !== queryNumber;
      if (operator === "gt") return value > queryNumber;
      if (operator === "lt") return value < queryNumber;
    });
  }

  // ── String operators (include, exclude, fuzzy) ───────────────
  // Build the list of strings we'll search inside.
  let stringsToSearch = [];

  if (field === "all") {
    // Search every text column at once
    stringsToSearch = [
      "name",
      "fullname",
      "race",
      "gender",
      "birth",
      "alignment",
      "publisher",
    ].map((col) => (getValue(hero, col) || "").toLowerCase());
  } else if (NUMERIC_COLUMNS.has(field)) {
    // Allow searching a numeric column by its text representation,
    // e.g. typing "100" in the strength field
    const value = getValue(hero, field);
    stringsToSearch = [value === null ? "" : String(value)];
  } else {
    stringsToSearch = [(getValue(hero, field) || "").toLowerCase()];
  }

  if (operator === "include")
    return stringsToSearch.some((s) => s.includes(queryLower));
  if (operator === "exclude")
    return stringsToSearch.every((s) => !s.includes(queryLower));
  if (operator === "fuzzy")
    return stringsToSearch.some((s) => fuzzyMatch(s, queryLower));

  // Fallback (shouldn't be reached)
  return stringsToSearch.some((s) => s.includes(queryLower));
}

// =============================================================
//  sortHeroes
//
//  Returns a sorted copy of the array — the original is never
//  mutated (slice() makes a shallow copy first).
//
//  Rules:
//  - Missing values always go last, regardless of direction.
//  - Numbers use numeric comparison (so 9 < 100, not "9" > "100").
//  - Strings use localeCompare so accents sort sensibly.
// =============================================================
function sortHeroes(heroes) {
  return heroes.slice().sort((a, b) => {
    const valueA = getValue(a, state.sortColumn);
    const valueB = getValue(b, state.sortColumn);

    const missingA = isMissing(valueA);
    const missingB = isMissing(valueB);

    // Both missing → treat as equal
    if (missingA && missingB) return 0;
    // Only A missing → A goes after B
    if (missingA) return 1;
    // Only B missing → B goes after A
    if (missingB) return -1;

    let comparison;
    if (typeof valueA === "number" && typeof valueB === "number") {
      comparison = valueA - valueB;
    } else {
      comparison = String(valueA).localeCompare(String(valueB), undefined, {
        sensitivity: "base", // case-insensitive, accent-insensitive
      });
    }

    return state.sortDirection === "asc" ? comparison : -comparison;
  });
}

// =============================================================
//  applyFiltersAndSort
//
//  The main pipeline. Call this whenever the search query,
//  alignment filter, or sort changes.
//
//  Steps:
//    1. Start with all heroes
//    2. Apply alignment filter
//    3. Apply search filter
//    4. Sort
//    5. Re-render the table and pagination
// =============================================================
function applyFiltersAndSort() {
  let result = state.heroes;

  // Step 1: Alignment filter
  if (state.alignmentFilter !== "all") {
    if (state.alignmentFilter === "neutral") {
      // "neutral" = anything that is neither "good" nor "bad"
      result = result.filter((hero) => {
        const alignment = hero.biography.alignment;
        return !alignment || (alignment !== "good" && alignment !== "bad");
      });
    } else {
      result = result.filter(
        (hero) => hero.biography.alignment === state.alignmentFilter,
      );
    }
  }

  // Step 2: Search filter
  if (state.searchQuery.trim()) {
    result = result.filter((hero) =>
      heroMatchesSearch(
        hero,
        state.searchQuery.trim(),
        state.searchField,
        state.searchOperator,
      ),
    );
  }

  // Step 3: Sort
  state.filtered = sortHeroes(result);

  // Always reset to page 1 when the filtered set changes
  state.currentPage = 1;

  // Step 4: Re-render
  renderTable();
  renderPagination();
  renderResultCount();
}
