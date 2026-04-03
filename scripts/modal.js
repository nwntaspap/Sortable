// =============================================================
//  modal.js
//
//  Handles the hero detail modal:
//    - openModal(hero) — populate and show the modal
//    - closeModal()    — hide it and clean up
//
//  Also contains two small HTML builder helpers used only
//  inside the modal:
//    - buildModalStatRow  — one stat bar row (label + bar + number)
//    - infoItem           — one key/value info pair
//
//  Depends on: helpers.js, render.js (missingCell),
//              state + dom (main.js)
// =============================================================

// =============================================================
//  buildModalStatRow
//  Returns the HTML for one row in the "Power Stats" section
//  of the modal: a label on the left, a coloured progress bar
//  in the middle, and the numeric value on the right.
// =============================================================
function buildModalStatRow(label, value, colour) {
  const missing = isMissing(value);

  return `
    <div class="modal-stat-row">
      <span class="modal-stat-label">${label}</span>
      <div class="modal-stat-bar">
        <div class="modal-stat-fill"
          style="width:${missing ? 0 : value}%; background:${colour};"></div>
      </div>
      <span class="modal-stat-value">${missing ? "—" : value}</span>
    </div>`;
}

// =============================================================
//  infoItem
//  Returns one label/value pair for the info grid sections
//  (Appearance, Biography).
//
//  fullWidth = true makes the item span both grid columns —
//  useful for long values like aliases or occupation.
// =============================================================
function infoItem(label, value, fullWidth = false) {
  const isEmpty = !value || value === "-" || value === "No alter egos found.";

  const displayValue = isEmpty
    ? `<span class="cell-missing">Unknown</span>`
    : value;

  return `
    <div class="info-item${fullWidth ? " full" : ""}">
      <div class="info-key">${label}</div>
      <div class="info-value">${displayValue}</div>
    </div>`;
}

// =============================================================
//  openModal
//  Fills the modal with the hero's data and makes it visible.
//
//  Also highlights the corresponding table row so the user
//  knows which hero they clicked.
// =============================================================
function openModal(hero) {
  state.openHeroId = hero.id;

  // Highlight the row in the table
  document
    .querySelectorAll("#tbody tr[data-id]")
    .forEach((row) =>
      row.classList.toggle("selected", Number(row.dataset.id) === hero.id),
    );

  const { powerstats, appearance, biography, work, connections } = hero;
  const alignment = biography.alignment || "";
  const alignClass =
    alignment === "good" ? "good" : alignment === "bad" ? "bad" : "neutral";

  dom.modalBody.innerHTML = `

    <!-- LEFT PANEL: large image + name -->
    <div class="modal-image-container">
      <img
        class="modal-image"
        src="${hero.images.lg || hero.images.md}"
        alt="${hero.name}"
        loading="lazy"
      />
      <div class="modal-hero-name">${hero.name}</div>
      <div class="modal-hero-fullname">${biography.fullName || "Unknown Identity"}</div>
      ${
        alignment
          ? `<span class="alignment-badge ${alignClass}" style="margin-top:4px">${alignment}</span>`
          : ""
      }
    </div>

    <!-- RIGHT PANEL: stats + biography -->
    <div class="modal-info">

      <div>
        <div class="section-title">⚡ Power Stats</div>
        <div class="modal-stats">
          ${buildModalStatRow("Intelligence", powerstats.intelligence, STAT_COLORS.intelligence)}
          ${buildModalStatRow("Strength", powerstats.strength, STAT_COLORS.strength)}
          ${buildModalStatRow("Speed", powerstats.speed, STAT_COLORS.speed)}
          ${buildModalStatRow("Durability", powerstats.durability, STAT_COLORS.durability)}
          ${buildModalStatRow("Power", powerstats.power, STAT_COLORS.power)}
          ${buildModalStatRow("Combat", powerstats.combat, STAT_COLORS.combat)}
        </div>
      </div>

      <div>
        <div class="section-title">🧬 Appearance</div>
        <div class="info-grid">
          ${infoItem("Race", appearance.race)}
          ${infoItem("Gender", appearance.gender)}
          ${infoItem("Height", (appearance.height || []).join(" / "))}
          ${infoItem("Weight", (appearance.weight || []).join(" / "))}
          ${infoItem("Eye Colour", appearance.eyeColor)}
          ${infoItem("Hair", appearance.hairColor)}
        </div>
      </div>

      <div>
        <div class="section-title">📋 Biography</div>
        <div class="info-grid">
          ${infoItem("Publisher", biography.publisher)}
          ${infoItem("Place of Birth", biography.placeOfBirth)}
          ${infoItem("First Appearance", biography.firstAppearance, true)}
          ${infoItem("Aliases", (biography.aliases || []).join(", "), true)}
          ${infoItem("Occupation", work.occupation, true)}
          ${infoItem("Base", work.base)}
          ${infoItem("Affiliation", connections.groupAffiliation, true)}
          ${infoItem("Relatives", connections.relatives, true)}
        </div>
      </div>

    </div>`;

  dom.modal.classList.add("open");
  document.body.style.overflow = "hidden"; // prevent page scroll while modal is open
  syncStateToURL();
}

// =============================================================
//  closeModal
//  Hides the modal and resets related state.
// =============================================================
function closeModal() {
  state.openHeroId = null;

  dom.modal.classList.remove("open");
  document.body.style.overflow = "";

  // Remove the highlight from the table row
  document
    .querySelectorAll("#tbody tr")
    .forEach((row) => row.classList.remove("selected"));

  syncStateToURL();
}
