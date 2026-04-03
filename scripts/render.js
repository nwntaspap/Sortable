// =============================================================
//  render.js
//
//  Everything that writes HTML into the page:
//    - Table rows (one per hero)
//    - Pagination buttons
//    - Result counter
//    - Sort header indicators (▲ ▼ ↕)
//    - Loading / empty / error states
//
//  Depends on: helpers.js, state + dom (defined in main.js)
// =============================================================

// =============================================================
//  missingCell
//  Small helper — returns the HTML for a "—" placeholder.
//  Kept as a function so the styling is defined in one place.
// =============================================================
function missingCell() {
  return `<span class="cell-missing">—</span>`;
}

// =============================================================
//  buildAlignmentBadge
//  Returns a coloured <span> badge for good / bad / neutral.
//  The CSS classes are defined in table.css.
// =============================================================
function buildAlignmentBadge(alignment) {
  if (!alignment || alignment === "-") return missingCell();

  const cssClass =
    alignment === "good" ? "good" : alignment === "bad" ? "bad" : "neutral";

  return `<span class="alignment-badge ${cssClass}">${alignment}</span>`;
}

// =============================================================
//  buildStatCell
//  Returns a <td> for one powerstat (e.g. strength = 80).
//  It shows the number plus a coloured bar that fills to the
//  same percentage — so 80 strength = 80% wide bar.
// =============================================================
function buildStatCell(statName, powerstats) {
  const value = powerstats[statName];
  const missing = isMissing(value);
  const colour = STAT_COLORS[statName];

  return `
    <td class="cell-stat" title="${statName}: ${missing ? "—" : value}">
      <span class="stat-value">${missing ? missingCell() : value}</span>
      ${missing ? "" : `<div class="stat-bar" style="width:${value}%; background:${colour};"></div>`}
    </td>`;
}

// =============================================================
//  buildRow
//  Returns the full <tr>...</tr> HTML for one hero.
//
//  For the weight cell: we now display the value in kg that
//  parseWeightKg calculated (which handles tons → kg conversion).
//  This means Godzilla shows "90000000 kg" instead of being blank.
// =============================================================
function buildRow(hero) {
  const { powerstats, appearance, biography } = hero;

  const heightArray = appearance.height || [];
  const weightArray = appearance.weight || [];
  const heightCm = parseHeightCm(heightArray);
  const weightKg = parseWeightKg(weightArray);
  const alignment = biography.alignment || "";

  // Mark the row as selected if its modal is currently open
  const selectedClass = state.openHeroId === hero.id ? ' class="selected"' : "";

  return `
    <tr data-id="${hero.id}"${selectedClass}>

      <td class="cell-icon">
        <img src="${hero.images.xs}" alt="${hero.name}" loading="lazy" />
      </td>

      <td class="cell-name">${hero.name || missingCell()}</td>

      <td class="cell-fullname">${biography.fullName || missingCell()}</td>

      ${buildStatCell("intelligence", powerstats)}
      ${buildStatCell("strength", powerstats)}
      ${buildStatCell("speed", powerstats)}
      ${buildStatCell("durability", powerstats)}
      ${buildStatCell("power", powerstats)}
      ${buildStatCell("combat", powerstats)}

      <td class="cell-race">${appearance.race || missingCell()}</td>
      <td>                  ${appearance.gender || missingCell()}</td>

      <td class="cell-height">
        ${heightCm ? heightArray.find((s) => s.endsWith("cm")) : missingCell()}
      </td>

      <td class="cell-weight">
        ${weightKg ? weightKg + " kg" : missingCell()}
      </td>

      <td class="cell-birth" title="${biography.placeOfBirth || ""}">
        ${
          biography.placeOfBirth && biography.placeOfBirth !== "-"
            ? biography.placeOfBirth
            : missingCell()
        }
      </td>

      <td class="cell-alignment">${buildAlignmentBadge(alignment)}</td>

    </tr>`;
}

// =============================================================
//  renderTable
//  Slices state.filtered to the current page and writes all
//  the rows into <tbody id="tbody">.
// =============================================================
function renderTable() {
  if (state.filtered.length === 0) {
    dom.tbody.innerHTML = `
      <tr>
        <td colspan="15">
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            No targets matched your query.
          </div>
        </td>
      </tr>`;
    return;
  }

  // Calculate which slice of the array to show
  let start, end;
  if (state.pageSize === "all") {
    start = 0;
    end = state.filtered.length;
  } else {
    start = (state.currentPage - 1) * state.pageSize;
    end = Math.min(start + state.pageSize, state.filtered.length);
  }

  dom.tbody.innerHTML = state.filtered.slice(start, end).map(buildRow).join("");
}

// =============================================================
//  buildPageButtons
//  Returns the HTML for the numbered page buttons.
//  Shows up to 7 page numbers; uses "…" for long ranges.
//
//  Examples (current page marked with *):
//    7 pages:  1 2 *3* 4 5 6 7
//    15 pages, on page 1:  *1* 2 3 4 5 … 15
//    15 pages, on page 8:  1 … 7 *8* 9 … 15
//    15 pages, on page 14: 1 … 11 12 13 *14* 15
// =============================================================
function buildPageButtons(totalPages) {
  const current = state.currentPage;

  // One numbered button
  const pageBtn = (page, isActive = false) =>
    `<button class="page-btn${isActive ? " active" : ""}"
      data-page="${page}">${page}</button>`;

  // A consecutive run of numbered buttons
  const range = (from, to) => {
    let html = "";
    for (let i = from; i <= to; i++) html += pageBtn(i, i === current);
    return html;
  };

  const ellipsis = `<span class="page-ellipsis">…</span>`;

  if (totalPages <= 7) return range(1, totalPages);
  if (current <= 4) return range(1, 5) + ellipsis + pageBtn(totalPages);
  if (current >= totalPages - 3)
    return pageBtn(1) + ellipsis + range(totalPages - 4, totalPages);
  return (
    pageBtn(1) +
    ellipsis +
    range(current - 1, current + 1) +
    ellipsis +
    pageBtn(totalPages)
  );
}

// =============================================================
//  renderPagination
//  Writes the "Showing X–Y of Z" text and page buttons into
//  <div id="pag">.
// =============================================================
function renderPagination() {
  // No pagination needed when everything fits on one page
  if (state.pageSize === "all" || state.filtered.length === 0) {
    dom.pagination.innerHTML = "";
    return;
  }

  const total = state.filtered.length;
  const totalPages = Math.ceil(total / state.pageSize);

  if (totalPages <= 1) {
    dom.pagination.innerHTML = "";
    return;
  }

  const firstOnPage = (state.currentPage - 1) * state.pageSize + 1;
  const lastOnPage = Math.min(state.currentPage * state.pageSize, total);

  dom.pagination.innerHTML = `
    <div class="page-info">
      Showing <strong>${firstOnPage}–${lastOnPage}</strong>
      of <strong>${total}</strong>
    </div>
    <div class="page-controls">
      <button class="page-btn"
        data-page="${state.currentPage - 1}"
        ${state.currentPage === 1 ? "disabled" : ""}>
        ‹ Prev
      </button>
      ${buildPageButtons(totalPages)}
      <button class="page-btn"
        data-page="${state.currentPage + 1}"
        ${state.currentPage === totalPages ? "disabled" : ""}>
        Next ›
      </button>
    </div>`;
}

// =============================================================
//  renderResultCount
//  Updates the "X / 731 targets" text in the toolbar.
// =============================================================
function renderResultCount() {
  dom.resultCount.innerHTML = `<span>${state.filtered.length}</span> / ${state.heroes.length} targets`;
}

// =============================================================
//  updateSortHeaders
//  Keeps the ▲ / ▼ / ↕ indicators in the <thead> in sync
//  with state.sortColumn and state.sortDirection.
// =============================================================
function updateSortHeaders() {
  document.querySelectorAll("th[data-col]").forEach((th) => {
    const column = th.dataset.col;
    const indicator = th.querySelector(".si");

    if (column === state.sortColumn) {
      th.classList.add("srt");
      if (indicator)
        indicator.textContent = state.sortDirection === "asc" ? "▲" : "▼";
    } else {
      th.classList.remove("srt");
      if (indicator) indicator.textContent = "↕";
    }
  });
}

// =============================================================
//  showError
//  Replaces the table body with a helpful error message.
//  Detects whether the page was opened as file:// and gives
//  the appropriate instructions.
// =============================================================
function showError() {
  const isFileProtocol = location.protocol === "file:";

  dom.tbody.innerHTML = `
    <tr>
      <td colspan="15">
        <div class="empty-state">
          <div class="error-box">
            <div class="error-title">⚠ FAILED TO LOAD DATA</div>
            <div class="error-message">
              ${
                isFileProtocol
                  ? `<strong>You are opening this file directly</strong> (<code>file://</code>).<br>
                   Browsers block <code>fetch()</code> from the filesystem for security reasons.<br>
                   You need to serve it via a local HTTP server:`
                  : "Could not reach the superhero API. Check your internet connection and try refreshing."
              }
            </div>
            ${
              isFileProtocol
                ? `
              <div class="error-help">
                <strong style="color:var(--gold)">Python (quickest):</strong><br>
                <code>python3 -m http.server 8080</code><br>
                Then open <code>http://localhost:8080</code><br><br>
                <strong style="color:var(--gold)">Node.js:</strong><br>
                <code>npx serve .</code><br><br>
                <strong style="color:var(--gold)">VS Code:</strong><br>
                Right-click <code>index.html</code> → <em>Open with Live Server</em>
              </div>`
                : ""
            }
          </div>
        </div>
      </td>
    </tr>`;
}
