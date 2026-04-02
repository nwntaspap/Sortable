// =============================================================
//  helpers.js
//
//  Pure data functions — no DOM, no side effects.
//  A "pure function" means: same input always gives same output,
//  and it doesn't change anything outside itself.
//
//  These are the building blocks used by every other file.
//  Start here when learning the codebase.
// =============================================================

// Colour used for the mini bar behind each powerstat number in the table
const STAT_COLORS = {
  intelligence: "#00b4d8",
  strength: "#e63946",
  speed: "#2ec4b6",
  durability: "#f4a261",
  power: "#9b5de5",
  combat: "#fee440",
};

// Columns whose values are numbers.
// Used by sort (numeric vs string compare) and search (numeric operators).
const NUMERIC_COLUMNS = new Set([
  "intelligence",
  "strength",
  "speed",
  "durability",
  "power",
  "combat",
  "height",
  "weight",
]);

// =============================================================
//  getValue
//  Given a hero object and a column name, return the value
//  we want to sort/search/display for that column.
//  Numbers stay as numbers; everything else becomes a string.
// =============================================================
function getValue(hero, column) {
  switch (column) {
    case "name":
      return hero.name || "";
    case "fullname":
      return hero.biography.fullName || "";
    case "intelligence":
      return hero.powerstats.intelligence;
    case "strength":
      return hero.powerstats.strength;
    case "speed":
      return hero.powerstats.speed;
    case "durability":
      return hero.powerstats.durability;
    case "power":
      return hero.powerstats.power;
    case "combat":
      return hero.powerstats.combat;
    case "race":
      return hero.appearance.race || "";
    case "gender":
      return hero.appearance.gender || "";
    case "height":
      return parseHeightCm(hero.appearance.height);
    case "weight":
      return parseWeightKg(hero.appearance.weight);
    case "birth":
      return hero.biography.placeOfBirth || "";
    case "alignment":
      return hero.biography.alignment || "";
    case "publisher":
      return hero.biography.publisher || "";
    default:
      return "";
  }
}

// =============================================================
//  parseHeightCm
//  The API gives height as an array like ["6'1", "185 cm"].
//  We find the "cm" entry and return it as a plain number.
//  Returns null when height is unknown or zero.
// =============================================================
function parseHeightCm(heightArray) {
  if (!heightArray) return null;

  const cmString = heightArray.find((s) => s.endsWith("cm"));
  if (!cmString) return null;

  const value = parseFloat(cmString);
  return value > 0 ? value : null;
}

// =============================================================
//  parseWeightKg
//  The API gives weight as an array like ["980 lb", "441 kg"].
//  Most heroes use kg, but very large characters use tons,
//  e.g. Godzilla: ["200000000 lb", "90,000 tons"].
//
//  Priority:
//    1. Try to find a "kg" entry and parse it directly.
//    2. If not found, look for a "tons" entry and convert
//       (1 metric ton = 1000 kg).
//
//  Note: some entries have commas in the number ("90,000 tons")
//  so we strip commas before parsing with parseFloat.
//
//  Returns null when weight is unknown or zero.
// =============================================================
function parseWeightKg(weightArray) {
  if (!weightArray) return null;

  // --- Try kg first ---
  const kgString = weightArray.find((s) => s.endsWith("kg"));
  if (kgString) {
    const value = parseFloat(kgString.replace(",", ""));
    return value > 0 ? value : null;
  }

  // --- Fall back to tons and convert ---
  const tonsString = weightArray.find((s) => s.endsWith("tons"));
  if (tonsString) {
    const tons = parseFloat(tonsString.replace(/,/g, "")); // remove all commas
    return tons > 0 ? tons * 1000 : null;
  }

  return null;
}

// =============================================================
//  isMissing
//  A single place to decide "does this value count as empty?".
//  The API uses "-" as a placeholder for unknown data.
// =============================================================
function isMissing(value) {
  return value === null || value === undefined || value === "" || value === "-";
}

// =============================================================
//  fuzzyMatch
//  Returns true if every character in `pattern` appears in
//  `str` in order (but not necessarily next to each other).
//
//  Example:
//    fuzzyMatch("batman", "btn")  → true  (b..t..n)
//    fuzzyMatch("batman", "xyz")  → false
//
//  This lets users type partial/abbreviated queries and still
//  find results.
// =============================================================
function fuzzyMatch(str, pattern) {
  let patternIndex = 0;

  for (let i = 0; i < str.length && patternIndex < pattern.length; i++) {
    if (str[i] === pattern[patternIndex]) patternIndex++;
  }

  // If we consumed the whole pattern, it matched
  return patternIndex === pattern.length;
}
