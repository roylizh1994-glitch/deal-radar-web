/**
 * Source Registry — single source of truth for all deal connectors.
 * Add a new source here; the pipeline picks it up automatically.
 * No core logic changes needed.
 */

export type ComplianceStatus =
  | 'approved'   // robots + ToS checked, cleared for production
  | 'pending'    // not yet audited — do not publish
  | 'poc_only'   // audit in progress or conditional — disabled in prod
  | 'blocked';   // explicitly disallowed

export type ConnectorType = 'rss' | 'atom' | 'html';

export interface SourceConfig {
  id: string;
  name: string;
  url: string;
  type: ConnectorType;
  /** 1=internal/curated, 2=editorial aggregator, 3=community/UGC */
  tier: 1 | 2 | 3;
  enabled: boolean;
  /** Score multiplier applied to items from this source (1.0 = neutral) */
  weight: number;
  intervalMinutes: number;
  complianceStatus: ComplianceStatus;
  complianceNote?: string;
  /** Apply editorial filter before parsing (article feeds with mixed content) */
  titleFilter?: 'deal_keyword';
}

// ─── Source list ──────────────────────────────────────────────────────────────
// Compliance audit records are in compliance.ts.
// To disable a source temporarily: set enabled: false.
// To retire a source permanently: set complianceStatus: 'blocked'.

export const SOURCES: SourceConfig[] = [

  // ── Tier 2: Editorial / curated aggregators ──────────────────────────────

  {
    id: 'slickdeals_frontpage',
    name: 'Slickdeals Frontpage',
    url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1',
    type: 'rss',
    tier: 2,
    enabled: true,
    weight: 1.2,
    intervalMinutes: 30,
    complianceStatus: 'approved',
    complianceNote: 'robots.txt allows /newsearch.php; ToS permits aggregation with attribution',
  },
  {
    id: 'slickdeals_popular',
    name: 'Slickdeals Popular',
    url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1',
    type: 'rss',
    tier: 2,
    enabled: true,
    weight: 1.3,
    intervalMinutes: 30,
    complianceStatus: 'approved',
    complianceNote: 'Same domain policy as slickdeals_frontpage; popular feed has higher signal-to-noise',
  },
  {
    id: '9to5toys',
    name: '9to5Toys',
    url: 'https://9to5toys.com/feed/',
    type: 'rss',
    tier: 2,
    enabled: true,
    weight: 1.1,
    intervalMinutes: 60,
    complianceStatus: 'approved',
    complianceNote: 'robots.txt allows /feed/; editorial deal posts only (titleFilter applied)',
    titleFilter: 'deal_keyword',
  },
  {
    id: '9to5mac',
    name: '9to5Mac',
    url: 'https://9to5mac.com/deals/feed/',
    type: 'rss',
    tier: 2,
    enabled: true,
    weight: 1.1,
    intervalMinutes: 60,
    complianceStatus: 'approved',
    complianceNote: 'Dedicated deals sub-feed; no title filter needed',
  },
  {
    id: 'woot',
    name: 'Woot',
    url: 'https://www.woot.com/feeds/all.rss',
    type: 'rss',
    tier: 2,
    enabled: true,
    weight: 1.0,
    intervalMinutes: 60,
    complianceStatus: 'approved',
    complianceNote: 'Woot provides official RSS; owned by Amazon — low legal risk',
  },
  {
    id: 'bensbargains',
    name: "Ben's Bargains",
    url: 'https://www.bensbargains.net/feed/',
    type: 'rss',
    tier: 2,
    enabled: true,
    weight: 1.0,
    intervalMinutes: 60,
    complianceStatus: 'approved',
    complianceNote: 'Standard WordPress RSS; robots.txt allows /feed/; ToS does not restrict aggregation',
  },
  {
    id: 'dealnews_electronics',
    name: 'DealNews Electronics',
    url: 'https://dealnews.com/feeds/published/Electronics.rss',
    type: 'rss',
    tier: 2,
    enabled: true,
    weight: 1.0,
    intervalMinutes: 60,
    complianceStatus: 'approved',
    complianceNote: 'DealNews provides category RSS feeds publicly; robots.txt verified 2026-05-01',
  },

  // ── Tier 3: Community / Reddit ─────────────────────────────────────────────

  {
    id: 'r_buildapcsales',
    name: 'r/buildapcsales',
    url: 'https://www.reddit.com/r/buildapcsales/new.rss',
    type: 'atom',
    tier: 3,
    enabled: true,
    weight: 1.0,
    intervalMinutes: 30,
    complianceStatus: 'approved',
    complianceNote: 'Reddit public RSS; ToS allows non-commercial aggregation',
  },
  {
    id: 'r_deals',
    name: 'r/deals',
    url: 'https://www.reddit.com/r/deals/new.rss',
    type: 'atom',
    tier: 3,
    enabled: true,
    weight: 1.0,
    intervalMinutes: 30,
    complianceStatus: 'approved',
    complianceNote: 'Reddit public RSS',
  },
  {
    id: 'r_techdeals',
    name: 'r/techdeals',
    url: 'https://www.reddit.com/r/techdeals/new.rss',
    type: 'atom',
    tier: 3,
    enabled: true,
    weight: 1.0,
    intervalMinutes: 30,
    complianceStatus: 'approved',
  },
  {
    id: 'r_laptopdeals',
    name: 'r/laptopdeals',
    url: 'https://www.reddit.com/r/laptopdeals/new.rss',
    type: 'atom',
    tier: 3,
    enabled: true,
    weight: 1.0,
    intervalMinutes: 30,
    complianceStatus: 'approved',
  },
  {
    id: 'r_appledeals',
    name: 'r/appledeals',
    url: 'https://www.reddit.com/r/appledeals/new.rss',
    type: 'atom',
    tier: 3,
    enabled: true,
    weight: 1.0,
    intervalMinutes: 30,
    complianceStatus: 'approved',
  },
  {
    id: 'r_GameDeals',
    name: 'r/GameDeals',
    url: 'https://www.reddit.com/r/GameDeals/new.rss',
    type: 'atom',
    tier: 3,
    enabled: true,
    weight: 1.0,
    intervalMinutes: 30,
    complianceStatus: 'approved',
  },
  {
    id: 'r_PS5Deals',
    name: 'r/PS5Deals',
    url: 'https://www.reddit.com/r/PS5Deals/new.rss',
    type: 'atom',
    tier: 3,
    enabled: true,
    weight: 1.0,
    intervalMinutes: 30,
    complianceStatus: 'approved',
    complianceNote: 'Reddit public RSS; console-specific deals',
  },
  {
    id: 'r_xboxdeals',
    name: 'r/xboxdeals',
    url: 'https://www.reddit.com/r/xboxdeals/new.rss',
    type: 'atom',
    tier: 3,
    enabled: true,
    weight: 1.0,
    intervalMinutes: 30,
    complianceStatus: 'approved',
    complianceNote: 'Reddit public RSS; console-specific deals',
  },
  {
    id: 'r_frugal',
    name: 'r/frugal',
    url: 'https://www.reddit.com/r/frugal/new.rss',
    type: 'atom',
    tier: 3,
    enabled: true,
    weight: 0.8,
    intervalMinutes: 60,
    complianceStatus: 'approved',
    complianceNote: 'Reddit public RSS; general frugality, lower signal than deal-specific subreddits → weight 0.8',
  },

  // ── PoC / Pending ──────────────────────────────────────────────────────────
  // These sources are NOT included in production; they require further audit.

  {
    id: 'dealmoon',
    name: 'DealMoon (北美省钱快报)',
    url: 'https://www.dealmoon.com',    // no public RSS — would require HTML connector
    type: 'html',
    tier: 2,
    enabled: false,
    weight: 1.2,
    intervalMinutes: 60,
    complianceStatus: 'poc_only',
    complianceNote: 'No public RSS feed. HTML scraping requires robots.txt + ToS review. robots.txt checked 2026-05-01: Disallow: /deal/ for many bots. ToS under review. Do NOT enable without legal sign-off.',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Sources active in production: enabled + compliance cleared. */
export function getActiveSources(): SourceConfig[] {
  return SOURCES.filter(s => s.enabled && s.complianceStatus === 'approved');
}

export function getSourceById(id: string): SourceConfig | undefined {
  return SOURCES.find(s => s.id === id);
}

/** Convert SourceConfig to the legacy RssFeed shape for backward compatibility. */
export function toLegacyFeed(s: SourceConfig) {
  return { url: s.url, name: s.name, tier: s.tier as 2 | 3 };
}
