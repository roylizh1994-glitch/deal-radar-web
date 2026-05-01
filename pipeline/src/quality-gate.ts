/**
 * Quality Gate v2 — P0A Implementation
 * Rules applied BEFORE publishing. Any fail = discard (never publish).
 *
 * Error codes:
 * QG001  MISSING_REQUIRED_FIELD
 * QG003  TITLE_INVALID_FORMAT
 * QG007  URL_DOMAIN_NOT_ALLOWLISTED
 * QG009  CATEGORY_BLOCKED
 * QG010  TITLE_TOO_SHORT
 * QG012  CONFIDENCE_TOO_LOW
 */

export interface RawDeal {
  id: string;
  title: string;
  source: string;
  deal_url: string;
  price_current?: number;
  price_original?: number;
  category?: string;
  brand?: string;
  model?: string;
  confidence_score?: number;
  raw_title?: string;
  // P1 fields
  source_tier?: 1 | 2 | 3;  // 1=high freshness, 3=low/reddit
  published_at?: string;     // ISO timestamp from source
  link_verified?: boolean;   // true if live link confirmed
  final_url?: string;        // resolved final URL after redirects
  is_external_link?: boolean; // true if deal_url is merchant, not Reddit thread
  age_hours?: number;         // pre-computed age in hours
  // purchasable_score components
  has_price?: boolean;
  has_add_to_cart?: boolean;  // not yet available at scrape time
  domain_matches_whitelist?: boolean;
}

// Source tier freshness baseline (P1: shorter half-life = more aggressive decay)
const TIER_FRESHNESS: Record<number, number> = { 1: 1.0, 2: 0.7, 3: 0.4 };

// Time windows
const MAX_AGE_HOURS_TIER3 = 24; // Reddit: max 24h old to even be considered

/**
 * Compute freshness_score with P1 shorter half-life (6h for Tier-3).
 * Strict time window: Tier-3 deals > 12h are auto-rejected.
 */
export function computeFreshnessScore(sourceTier: number, publishedAt?: string, ageHours?: number): number {
  if (sourceTier === 3 && ageHours !== undefined && ageHours > MAX_AGE_HOURS_TIER3) {
    return 0; // auto-reject old Reddit posts
  }
  const baseFreshness = TIER_FRESHNESS[sourceTier] ?? 0.5;
  if (ageHours === undefined) {
    if (!publishedAt) return baseFreshness * 0.5;
    ageHours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
  }
  // P1: steeper decay — half-life at 12h for Tier-3, 24h for others
  const halfLife = sourceTier === 3 ? 12 : 24;
  const decay = Math.max(0.2, 1 - ageHours / halfLife);
  return Math.round(baseFreshness * decay * 100) / 100;
}

/**
 * Reddit: 禁直接入榜。只允许带真实 merchant URL 的 Reddit 内容通过。
 */
export function applyRedditPenalty(confidence: number, source: string): number {
  const domain = source.toLowerCase();
  if (domain.includes('reddit.com') || domain.includes('redd.it')) {
    return Math.round(confidence * 0.7 * 1000) / 1000;
  }
  return confidence;
}

/**
 * Compute purchasable_score (0~1).
 * Must >= 0.7 to pass gate.
 * Components:
 * - price present: +0.3
 * - merchant URL (not Reddit thread): +0.4
 * - domain in whitelist: +0.3
 */
export function computePurchasableScore(deal: RawDeal): number {
  let score = 0;
  if (deal.price_current !== undefined && deal.price_current > 0) score += 0.3;
  if (deal.is_external_link !== false) score += 0.4; // merchant URL = +0.4
  const domain = extractDomain(deal.deal_url);
  const isMerchant = domain && !domain.includes('reddit.com') && !domain.includes('redd.it');
  if (isMerchant) score += 0.3;
  return Math.round(score * 100) / 100;
}

export const PURCHASABLE_THRESHOLD = 0.7;

export interface GateResult {
  id: string;
  passed: boolean;
  errors: GateError[];
  normalized?: NormalizedDeal;
}

export interface GateError {
  code: string;
  reason: string;
  field?: string;
  value?: unknown;
}

export interface NormalizedDeal {
  id: string;
  title: string;
  brand: string;
  model: string;
  category: string;
  price_current: number;
  price_original: number;
  discount_pct: number;
  deal_url: string;
  source: string;
  confidence_score: number;
  score: number;
  // P1 fields
  freshness_score: number;
  source_tier: number;
  final_url?: string;
  link_verified_at?: string;
  published_at?: string;
}

const ALLOWED_DOMAINS = new Set([
  // Major US merchants
  'amazon.com', 'www.amazon.com', 'a.co', 'amzn.com',
  'bestbuy.com', 'www.bestbuy.com',
  'newegg.com', 'www.newegg.com',
  'walmart.com', 'www.walmart.com',
  'target.com', 'www.target.com',
  'bhphotovideo.com', 'www.bhphotovideo.com',
  'adorama.com', 'www.adorama.com',
  'apple.com', 'www.apple.com',
  'samsung.com', 'www.samsung.com',
  'dell.com', 'www.dell.com',
  'hp.com', 'www.hp.com',
  'lenovo.com', 'www.lenovo.com',
  'microsoft.com', 'www.microsoft.com',
  'camelcamelcamel.com',
  // Deal aggregators (discovery only, not primary merchant)
  'slickdeals.net', 'www.slickdeals.net',
  'reddit.com', 'www.reddit.com',
  // Woot group
  'woot.com', 'www.woot.com',
  'sellout.woot.com', 'computers.woot.com', 'electronics.woot.com',
  // Micro Center
  'microcenter.com', 'www.microcenter.com',
  // US retailers
  'b&h.com', 'www.bh.com',
  'logitech.com', 'www.logitech.com',
  'corsair.com', 'www.corsair.com',
  // Amazon global
  'amazon.co.uk', 'www.amazon.co.uk',
  'amazon.de', 'www.amazon.de',
  'amazon.ca', 'www.amazon.ca',
  // Canadian merchants
  'bestbuy.ca', 'www.bestbuy.ca',
  'canadacomputers.com', 'www.canadacomputers.com',
  'newegg.ca', 'www.newegg.ca',
  'memoryexpress.com', 'www.memoryexpress.com',
  // Steam / gaming
  'store.steampowered.com', 'steampowered.com',
  'humble.com', 'www.humble.com',
  'gog.com', 'www.gog.com',
  // UK merchants
  'currys.co.uk', 'www.currys.co.uk',
  'overclockers.co.uk', 'www.overclockers.co.uk',
  'scan.co.uk', 'www.scan.co.uk',
  // PC components
  'nzxt.com', 'www.nzxt.com',
  'fractal-design.com', 'www.fractal-design.com',
  'bequiet.com', 'bequiet.com',
  'phanteks.com', 'www.phanteks.com',
  'deepcool.com', 'www.deepcool.com',
  // eBay
  'ebay.com', 'www.ebay.com',
  'ebay.ca', 'www.ebay.ca',
  'ebay.co.uk', 'www.ebay.co.uk',
  // Tech deal aggregators (link to curated deal articles)
  '9to5toys.com', 'www.9to5toys.com',
  '9to5mac.com', 'www.9to5mac.com',
  '9to5google.com', 'www.9to5google.com',
  'dealnews.com', 'www.dealnews.com',
  // US retailers extras
  'costco.com', 'www.costco.com',
  'rakuten.com', 'www.rakuten.com',
  'antonline.com', 'www.antonline.com',
  'bhphotovideo.com',
]);

const BLOCKED_CATEGORIES = new Set(['Other', 'other', 'OTHER', '']);
const CONFIDENCE_THRESHOLD = 0.50;

// ─── Title Validation ────────────────────────────────────────────────────────

export function isNumericTitle(title: string): boolean {
  if (!title) return true;
  const cleaned = title.trim();
  if (/^\d+$/.test(cleaned)) return true;
  if (cleaned.length <= 1) return true;
  return false;
}

export function isTitleTooShort(title: string): boolean {
  if (!title) return true;
  return title.trim().length < 8;
}

export function recoverTitleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('amazon.com')) {
      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
      if (asinMatch) return `[AMAZON:${asinMatch[1]}]`;
    }
  } catch {
    // invalid URL
  }
  return null;
}

// ─── Field Completeness ─────────────────────────────────────────────────────

export function missingRequiredFields(deal: RawDeal): string[] {
  const missing: string[] = [];
  if (!deal.title || deal.title.trim() === '') missing.push('title');
  if (!deal.deal_url || deal.deal_url.trim() === '') missing.push('deal_url');
  if (deal.price_current === undefined || deal.price_current === null) missing.push('price_current');
  if (!deal.source || deal.source.trim() === '') missing.push('source');
  return missing;
}

// ─── Domain Validation ──────────────────────────────────────────────────────

export function extractDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function isDomainAllowed(url: string): boolean {
  const domain = extractDomain(url);
  if (!domain) return false;
  return ALLOWED_DOMAINS.has(domain);
}

export function isConfidenceAcceptable(deal: RawDeal): boolean {
  if (deal.confidence_score === undefined || deal.confidence_score === null) return true;
  return deal.confidence_score >= CONFIDENCE_THRESHOLD;
}

// ─── Main Gate Function ───────────────────────────────────────────────────────

export function runQualityGate(deal: RawDeal): GateResult {
  const errors: GateError[] = [];

  const missing = missingRequiredFields(deal);
  if (missing.length > 0) {
    errors.push({ code: 'QG001', reason: 'MISSING_REQUIRED_FIELD', field: missing.join(',') });
  }

  if (deal.title && isNumericTitle(deal.title)) {
    errors.push({ code: 'QG003', reason: 'TITLE_INVALID_FORMAT', field: 'title', value: deal.title });
  }

  if (deal.title && isTitleTooShort(deal.title)) {
    errors.push({ code: 'QG010', reason: 'TITLE_TOO_SHORT', field: 'title', value: deal.title });
  }

  if (deal.deal_url && !isDomainAllowed(deal.deal_url)) {
    const domain = extractDomain(deal.deal_url) ?? 'unknown';
    errors.push({ code: 'QG007', reason: 'URL_DOMAIN_NOT_ALLOWLISTED', field: 'deal_url', value: domain });
  }

  if (deal.category && BLOCKED_CATEGORIES.has(deal.category.trim())) {
    errors.push({ code: 'QG009', reason: 'CATEGORY_BLOCKED', field: 'category', value: deal.category });
  }

  if (!isConfidenceAcceptable(deal)) {
    errors.push({ code: 'QG012', reason: 'CONFIDENCE_TOO_LOW', field: 'confidence_score', value: deal.confidence_score });
  }

  // QG016: Both prices known but current >= original → not actually a deal
  if (
    deal.price_current !== undefined && deal.price_current > 0 &&
    deal.price_original !== undefined && deal.price_original > 0 &&
    deal.price_current >= deal.price_original
  ) {
    errors.push({ code: 'QG016', reason: 'NO_DISCOUNT_PRICE_NOT_REDUCED', field: 'price_current', value: deal.price_current });
  }

  // P1 NEW RULES:

  // QG013: Reddit thread without merchant URL → discovery only, cannot rank directly
  const dealDomain = extractDomain(deal.deal_url) ?? '';
  const isRedditThread = dealDomain.includes('reddit.com') || dealDomain.includes('redd.it');
  const hasMerchantUrl = deal.is_external_link === true && !isRedditThread;
  if (isRedditThread && !hasMerchantUrl) {
    errors.push({ code: 'QG013', reason: 'REDDIT_THREAD_NO_MERCHANT', field: 'deal_url', value: deal.deal_url });
  }

  // QG015: Tier-3 Reddit posts older than 12h → auto-reject
  const source_tier = deal.source_tier ?? 3;
  const age_hours = deal.age_hours ?? (deal.published_at
    ? (Date.now() - new Date(deal.published_at).getTime()) / (1000 * 60 * 60)
    : 999);
  if (source_tier === 3 && age_hours > MAX_AGE_HOURS_TIER3) {
    errors.push({ code: 'QG015', reason: 'POST_TOO_OLD', field: 'age_hours', value: age_hours });
  }

  if (errors.length > 0) {
    return { id: deal.id, passed: false, errors };
  }

  // QG014: purchasable_score must be >= 0.7
  const purchasable_score = computePurchasableScore(deal);
  if (purchasable_score < PURCHASABLE_THRESHOLD) {
    errors.push({ code: 'QG014', reason: 'NOT_PURCHASABLE', field: 'purchasable_score', value: purchasable_score });
    return { id: deal.id, passed: false, errors };
  }

  // Apply Reddit penalty before gate
  const rawConfidence = deal.confidence_score ?? 0.6;
  const confidence_score = applyRedditPenalty(rawConfidence, deal.source);

  // Compute freshness with steeper decay
  const freshness_score = computeFreshnessScore(source_tier, deal.published_at, age_hours);

  const normalized: NormalizedDeal = {
    id: deal.id,
    title: normalizeTitle(deal.title),
    brand: deal.brand ?? 'Unknown',
    model: deal.model ?? '',
    category: deal.category ?? 'Other',
    price_current: deal.price_current ?? 0,
    price_original: deal.price_original ?? deal.price_current ?? 0,
    discount_pct: calculateDiscount(deal.price_current, deal.price_original),
    deal_url: deal.deal_url,
    source: deal.source,
    confidence_score,
    freshness_score,
    source_tier,
    score: 0,
    final_url: deal.final_url,
    published_at: deal.published_at,
    link_verified_at: deal.link_verified ? new Date().toISOString() : undefined,
  };

  return { id: deal.id, passed: true, errors: [], normalized };
}

// ─── Normalization Helpers ───────────────────────────────────────────────────

export function normalizeTitle(title: string): string {
  if (!title) return 'Unknown Product';
  let t = title.trim();
  t = t.replace(/\[AMAZON:[A-Z0-9]{10}\]/gi, '').trim();
  t = t.replace(/\s*[-–—]\s*\$[\d,]+\.?\d*/g, '');
  // Only strip promo noise at end — don't strip "deal" from mid-sentence article titles
  t = t.replace(/\s+[-–—]\s*(折扣|优惠|promo|coupon)\s*\w*\s*$/i, '');
  t = t.replace(/\s+(折扣|优惠|coupon\s*code)\s*\w*\s*$/i, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t || 'Unknown Product';
}

export function calculateDiscount(current?: number, original?: number): number {
  if (!current || !original || original <= 0 || current >= original) return 0;
  return Math.round((1 - current / original) * 1000) / 1000;
}

// ─── Batch Gate Runner ───────────────────────────────────────────────────────

export interface GateSummary {
  total: number;
  passed: number;
  rejected: number;
  error_breakdown: { code: string; reason: string; count: number }[];
  sample_rejects: { id: string; title: string; source: string; error_codes: string[] }[];
  qualified_rate: number;
  other_ratio: number;
}

export function runGateOnBatch(deals: RawDeal[]): {
  results: GateResult[];
  summary: GateSummary;
} {
  const results = deals.map(d => runQualityGate(d));
  const passed = results.filter(r => r.passed);
  const rejected = results.filter(r => !r.passed);

  const errorMap = new Map<string, { code: string; reason: string; count: number }>();
  for (const r of rejected) {
    for (const e of r.errors) {
      const key = e.code;
      if (!errorMap.has(key)) {
        errorMap.set(key, { code: e.code, reason: e.reason, count: 0 });
      }
      errorMap.get(key)!.count++;
    }
  }

  const error_breakdown = Array.from(errorMap.values()).sort((a, b) => b.count - a.count);

  const sample_rejects = rejected.slice(0, 20).map(r => {
    const deal = deals.find(d => d.id === r.id);
    return {
      id: r.id,
      title: deal?.title ?? 'unknown',
      source: deal?.source ?? 'unknown',
      error_codes: r.errors.map(e => e.code),
    };
  });

  const qualified_count = passed.length;
  const raw_count = deals.length;
  const qualified_rate = raw_count > 0 ? qualified_count / raw_count : 0;
  const other_count = passed.filter(r => r.normalized?.category === 'Other').length;
  const other_ratio = qualified_count > 0 ? other_count / qualified_count : 0;

  return {
    results,
    summary: {
      total: raw_count,
      passed: qualified_count,
      rejected: rejected.length,
      error_breakdown,
      sample_rejects,
      qualified_rate,
      other_ratio,
    },
  };
}