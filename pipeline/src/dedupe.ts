/**
 * Deduplication Engine — P0B Implementation
 * Groups near-identical deals across sources by brand+model key.
 * Keeps only the highest composite_score entry per group.
 */

import type { NormalizedDeal } from './quality-gate.js';

// ─── Hard Key Normalization ──────────────────────────────────────────────────

/**
 * Build a hard key from brand + model for dedup grouping.
 * Steps:
 * 1. Lowercase, strip brand prefix (already extracted)
 * 2. Normalize model tokens: remove spaces, dashes, version numbers
 * 3. Strip capacity/color variants that cause false splits
 *
 * Examples:
 * "beats|studio_pro| "     → "beats|studio_pro" (capacity stripped)
 * "apple|iphone_15_pro|128gb|black" → "apple|iphone_15_pro"
 * "samsung|galaxy_s24|ultra|256gb"  → "samsung|galaxy_s24_ultra"
 */
export function buildHardKey(deal: NormalizedDeal): string {
  const brand = (deal.brand ?? 'unknown').toLowerCase().replace(/\s+/g, '').trim();
  const modelRaw = (deal.model ?? '').toLowerCase().trim();

  const model = normalizeModelToken(modelRaw);
  return `${brand}|${model}`;
}

export function normalizeModelToken(model: string): string {
  if (!model) return '';

  let t = model
    // Remove common brand names from model prefix
    .replace(/^(apple|apple_)/i, '')
    .replace(/^(samsung|samsung_)/i, '')
    .replace(/^(sony|sony_)/i, '')
    .replace(/^(lg|lg_)/i, '')
    .replace(/^(dell|dell_)/i, '')
    .replace(/^(asus|asus_)/i, '')
    .replace(/^(acer|acer_)/i, '')
    .replace(/^(lenovo|lenovo_)/i, '')
    .replace(/^(hp|hp_|hewlett)/i, '')
    .replace(/^(razer|razer_)/i, '')
    // Normalize dashes/underscores to underscore
    .replace(/[-_]+/g, '_')
    // Remove storage/capacity: 128gb, 256gb, 1tb — handle underscore-separated too
    .replace(/(^|_|-)(\d{2,4}gb|\d+tb)/gi, '')
    // Remove color variants
    .replace(/(^|_|-)(black|white|silver|blue|red|green|purple|gold|space.?gray)/gi, '')
    // Normalize common model family suffixes
    .replace(/_?(pro|air|ultra|max|mini|plus)\b/gi, '_$1');

  // Collapse remaining separators
  t = t.replace(/[_\s]+/g, '').trim();
  return t;
}

/**
 * For monitor SKUs: tight alias map for common model number variations.
 * e.g. "U2722D" → "U2722D" (normalized), "U2722DE" → same group
 */
export const MONITOR_ALIAS_MAP: Record<string, string> = {
  // Dell UltraSharp
  'u2722d': 'u2722d', 'u2722de': 'u2722d', 'u2722dz': 'u2722d',
  'u3223qe': 'u3223qe',
  'u3423qw': 'u3423qw',
  'p2722h': 'p2722h', 'p2722he': 'p2722h',
  'p3222qe': 'p3222qe',
  // LG UltraFine / NanoIPS
  '27gp950': '27gp950', '27gp950b': '27gp950',
  '27ul850': '27ul850', '27ul850w': '27ul850',
  '32gp950': '32gp950',
  // Samsung Odyssey / Smart Monitor
  's27bg400': 's27bg400', 's27bg40': 's27bg400',
  's32bg400': 's32bg400',
  'm80b': 'm80b', 'm80c': 'm80c',
  // ASUS ProArt / ROG
  'pa278cv': 'pa278cv', 'pa278cev': 'pa278cv',
  'proart_pa329cv': 'pa329cv', 'pa329cv': 'pa329cv',
  'vg279qm': 'vg279qm', 'vg279q': 'vg279qm',
  // BenQ PD / EW
  'pd2700u': 'pd2700u', 'pd2706ua': 'pd2706ua',
  'ew3280u': 'ew3280u',
};

export function applyMonitorAlias(normalizedKey: string): string {
  const lower = normalizedKey.toLowerCase();
  for (const [alias, canonical] of Object.entries(MONITOR_ALIAS_MAP)) {
    if (lower.includes(alias)) return canonical;
  }
  return normalizedKey;
}

// ─── Deduplication ──────────────────────────────────────────────────────────

export interface DedupGroup {
  hard_key: string;
  entries: NormalizedDeal[];
  kept: NormalizedDeal;
  dropped_ids: string[];
  kept_score: number;
}

export interface DedupResult {
  groups: DedupGroup[];
  merged_groups: number;
  dropped_duplicates: number;
  deduped_list: NormalizedDeal[];
}

export function deduplicate(deals: NormalizedDeal[]): DedupResult {
  // Step 1: Group by hard key
  const groups = new Map<string, NormalizedDeal[]>();

  for (const deal of deals) {
    let key = buildHardKey(deal);
    // Apply monitor alias resolution
    key = applyMonitorAlias(key);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(deal);
  }

  // Step 2: For each group, keep highest composite score
  const resultGroups: DedupGroup[] = [];
  let droppedCount = 0;

  for (const [hard_key, entries] of groups) {
    if (entries.length === 1) {
      resultGroups.push({
        hard_key,
        entries,
        kept: entries[0],
        dropped_ids: [],
        kept_score: entries[0].score,
      });
      continue;
    }

    // Multiple entries → sort by score desc, keep top
    const sorted = [...entries].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const kept = sorted[0];
    const dropped = sorted.slice(1);
    droppedCount += dropped.length;

    resultGroups.push({
      hard_key,
      entries,
      kept,
      dropped_ids: dropped.map(d => d.id),
      kept_score: kept.score ?? 0,
    });
  }

  const merged_groups = resultGroups.filter(g => g.dropped_ids.length > 0).length;

  return {
    groups: resultGroups,
    merged_groups,
    dropped_duplicates: droppedCount,
    deduped_list: resultGroups.map(g => g.kept),
  };
}

// ─── Composite Score ─────────────────────────────────────────────────────────

/**
 * Compute composite score from business_score * confidence_score * freshness_score.
 * P1: freshness_score is now included to penalize old/stale deals.
 * Called after dedup to re-rank the deduped list.
 */
export function computeCompositeScore(
  deal: NormalizedDeal,
  opts: {
    field_completeness: number;   // 0~1
    price_history_sample_count: number;
    source_trust_level: number;   // 0~1
    recent_fetch_success_rate: number; // 0~1
  }
): number {
  const { field_completeness, price_history_sample_count, source_trust_level, recent_fetch_success_rate } = opts;

  const confidence_factors =
    field_completeness * 0.25 +
    Math.min(1, price_history_sample_count / 30) * 0.15 +
    source_trust_level * 0.25 +
    recent_fetch_success_rate * 0.15;

  const adjusted_confidence = deal.confidence_score * confidence_factors;
  const freshness = deal.freshness_score ?? 0.5;

  // composite = business_score * adjusted_confidence * freshness
  return Math.round(deal.score * adjusted_confidence * freshness * 10000) / 10000;
}

// ─── Monitor SKU Tightening (from today's report feedback) ───────────────────

/**
 * Given a deal title that looks like a numeric/partial SKU,
 * try to resolve to a canonical model name using known patterns.
 */
export function resolveMonitorSku(title: string): string | null {
  // Common patterns: U2722D, 27GP950, PD2700U
  const skuMatch = title.match(/\b([A-Z]{1,2}\d{4}[A-Z]?)\b/i);
  if (skuMatch) {
    const sku = skuMatch[1].toLowerCase();
    for (const [alias, canonical] of Object.entries(MONITOR_ALIAS_MAP)) {
      if (sku.startsWith(alias.replace(/\d+/g, '')) || alias.includes(sku.replace(/\d+/g, ''))) {
        return canonical;
      }
    }
  }
  return null;
}