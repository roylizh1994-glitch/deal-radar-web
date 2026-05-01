/**
 * Brand & Category Configuration
 *
 * Controls the two highest-leverage levers in the scoring model:
 *   business_score ×= brand_multiplier × category_multiplier × condition_penalty
 *
 * Editing this file is the primary way to tune "what gets to the top of the榜单".
 * No core pipeline logic changes required.
 */

// ─── Brand tiers ──────────────────────────────────────────────────────────────
// S  → 1.40×  household-name premium tech brands, high purchase intent
// A  → 1.20×  mainstream enthusiast / popular consumer brands
// B  → 1.00×  recognized but less mass-market
// unknown → 0.65× (everything not in the list)

export const BRAND_MULTIPLIERS: Record<string, number> = {
  // S-tier ─────────────────────────────────────────────────────────────────
  apple:       1.40,
  samsung:     1.40,
  sony:        1.40,
  lg:          1.35,
  dell:        1.35,
  microsoft:   1.35,
  nvidia:      1.40,
  amd:         1.35,
  intel:       1.35,

  // A-tier ─────────────────────────────────────────────────────────────────
  hp:          1.20,
  lenovo:      1.20,
  asus:        1.25,
  acer:        1.15,
  msi:         1.20,
  google:      1.20,
  bose:        1.20,
  jbl:         1.15,
  logitech:    1.20,
  anker:       1.15,
  dji:         1.20,
  canon:       1.20,
  nikon:       1.20,
  razer:       1.15,
  corsair:     1.15,
  kingston:    1.10,
  seagate:     1.10,
  'western digital': 1.10,
  wd:          1.10,
  sandisk:     1.10,
  crucial:     1.10,
  gigabyte:    1.10,
  asrock:      1.10,
  evga:        1.10,
  'be quiet':  1.10,
  nzxt:        1.10,
  elgato:      1.10,
  steelseries: 1.10,
  hyperx:      1.10,
  sennheiser:  1.15,
  jabra:       1.10,
  philips:     1.10,
  panasonic:   1.10,
  pioneer:     1.10,
  rode:        1.10,
  shure:       1.10,
  behringer:   1.05,
  netgear:     1.10,
  'tp-link':   1.05,
  eero:        1.10,
  ring:        1.10,
  nest:        1.10,
  ecobee:      1.05,
  xbox:        1.20,
  playstation: 1.20,
  nintendo:    1.20,
  steam:       1.05,
  'oculus':    1.10,
  meta:        1.10,
  fitbit:      1.05,
  garmin:      1.15,
  gopro:       1.10,
  fujifilm:    1.10,
  'de longhi': 1.05,

  // B-tier ─────────────────────────────────────────────────────────────────
  fractal:     1.00,
  phanteks:    1.00,
  deepcool:    1.00,
  coolermaster: 1.00,
  thermaltake: 1.00,
  mophie:      1.00,
  belkin:      1.00,
  otterbox:    1.00,
  spigen:      0.95,
  'blue yeti': 1.00,
  focusrite:   1.00,
  audio:       1.00,   // "Audio-Technica" etc
  klipsch:     1.00,
  harman:      1.00,
  epson:       1.00,
  brother:     1.00,
  pny:         0.90,
  'g.skill':   1.00,
  teamgroup:   0.90,
  patriot:     0.90,
};

export const UNKNOWN_BRAND_MULTIPLIER = 0.65;

/** Lookup brand multiplier (normalises to lowercase). */
export function getBrandMultiplier(brand: string): number {
  const key = brand.toLowerCase().trim();
  // Exact match
  if (BRAND_MULTIPLIERS[key] !== undefined) return BRAND_MULTIPLIERS[key];
  // Partial match (e.g. "Samsung Galaxy" → "samsung")
  for (const [k, v] of Object.entries(BRAND_MULTIPLIERS)) {
    if (key.startsWith(k) || key.includes(k)) return v;
  }
  return UNKNOWN_BRAND_MULTIPLIER;
}

/** True if this brand appears in any tier of the whitelist. */
export function isWhitelistedBrand(brand: string): boolean {
  return getBrandMultiplier(brand) >= 1.0;
}

// ─── Category tiers ───────────────────────────────────────────────────────────
// A → 1.30×  high-purchase-intent core tech
// B → 1.00×  mainstream complementary
// C → 0.60×  low-demand / noise / commodities

export type CategoryTier = 'A' | 'B' | 'C';

export const CATEGORY_TIERS: Record<string, CategoryTier> = {
  GPU:        'A',
  CPU:        'A',
  Laptop:     'A',
  Phone:      'A',
  Monitor:    'A',
  Tablet:     'A',
  Audio:      'A',
  Camera:     'A',
  // B ───────
  RAM:        'B',
  Storage:    'B',
  'PC Parts': 'B',
  Peripheral: 'B',
  TV:         'B',
  Wearable:   'B',
  Networking: 'B',
  Gaming:     'B',
  Projector:  'B',
  // C ───────
  Accessory:  'C',
  Software:   'C',
  Other:      'C',
};

const CATEGORY_MULTIPLIERS: Record<CategoryTier, number> = {
  A: 1.30,
  B: 1.00,
  C: 0.60,
};

export function getCategoryTier(category: string): CategoryTier {
  return CATEGORY_TIERS[category] ?? 'C';
}

export function getCategoryMultiplier(category: string): number {
  return CATEGORY_MULTIPLIERS[getCategoryTier(category)];
}

// ─── Condition / quality penalties ───────────────────────────────────────────

const REFURB_RE = /\b(refurb(ished)?|open.?box|certified.pre.?owned|renewed|remanufactured|pre.?owned)\b/i;

export function isRefurb(title: string): boolean {
  return REFURB_RE.test(title);
}

/** 0.75 for refurb/open-box; 1.0 otherwise. */
export function getConditionMultiplier(title: string): number {
  return isRefurb(title) ? 0.75 : 1.0;
}

// ─── Price floor ──────────────────────────────────────────────────────────────
// Sub-$15 items in non-core categories generate noise (cheap cables, adapters, etc.)

const PRICE_FLOOR_USD = 15;
const PRICE_FLOOR_EXEMPT_CATEGORIES = new Set<CategoryTier>(['A', 'B']); // only penalise C-tier

export function getPriceFloorMultiplier(price: number, category: string): number {
  if (price <= 0) return 1.0; // unknown price — don't penalise
  const tier = getCategoryTier(category);
  if (PRICE_FLOOR_EXEMPT_CATEGORIES.has(tier)) return 1.0;
  return price < PRICE_FLOOR_USD ? 0.40 : 1.0;
}
