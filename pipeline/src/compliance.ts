/**
 * Compliance — robots.txt cache + ToS allowlist.
 *
 * Policy:
 * - Only sources in SOURCE_AUDIT with status 'approved' may enter production.
 * - robots.txt is fetched once per domain per pipeline run (in-memory cache).
 * - A source that passes robots check but has no ToS audit is treated as 'pending'.
 */

// ─── ToS Audit records ────────────────────────────────────────────────────────

export type AuditStatus = 'approved' | 'pending' | 'poc_only' | 'blocked';

export interface ComplianceAudit {
  sourceId: string;
  domain: string;
  robotsAllowedPaths: string[];   // paths explicitly checked
  tosNotes: string;
  status: AuditStatus;
  auditDate: string;              // ISO date string
  auditedBy: string;
}

export const SOURCE_AUDIT: ComplianceAudit[] = [
  {
    sourceId: 'slickdeals_frontpage',
    domain: 'slickdeals.net',
    robotsAllowedPaths: ['/newsearch.php'],
    tosNotes: 'ToS §4 permits RSS feed consumption. No prohibition on price aggregation with attribution and link-back.',
    status: 'approved',
    auditDate: '2026-05-01',
    auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'slickdeals_popular',
    domain: 'slickdeals.net',
    robotsAllowedPaths: ['/newsearch.php'],
    tosNotes: 'Same domain policy as slickdeals_frontpage.',
    status: 'approved',
    auditDate: '2026-05-01',
    auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: '9to5toys',
    domain: '9to5toys.com',
    robotsAllowedPaths: ['/feed/'],
    tosNotes: 'Standard WordPress site. robots.txt does not disallow /feed/. Editorial content; summaries with link-back comply with fair use.',
    status: 'approved',
    auditDate: '2026-05-01',
    auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: '9to5mac',
    domain: '9to5mac.com',
    robotsAllowedPaths: ['/deals/feed/'],
    tosNotes: 'Dedicated deals RSS endpoint. Same policy as 9to5toys.',
    status: 'approved',
    auditDate: '2026-05-01',
    auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'woot',
    domain: 'woot.com',
    robotsAllowedPaths: ['/feeds/'],
    tosNotes: 'Amazon-owned property. Official RSS provided at /feeds/all.rss. ToS allows personal/non-commercial RSS consumption.',
    status: 'approved',
    auditDate: '2026-05-01',
    auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'bensbargains',
    domain: 'bensbargains.net',
    robotsAllowedPaths: ['/feed/'],
    tosNotes: "Standard WordPress RSS. Ben's Bargains does not restrict RSS aggregation in ToS.",
    status: 'approved',
    auditDate: '2026-05-01',
    auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'dealnews_electronics',
    domain: 'dealnews.com',
    robotsAllowedPaths: ['/feeds/'],
    tosNotes: 'DealNews provides public category RSS. ToS: "You may display DealNews content as long as you include a link to the original deal." Compliant.',
    status: 'approved',
    auditDate: '2026-05-01',
    auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'r_buildapcsales',
    domain: 'reddit.com',
    robotsAllowedPaths: ['/r/'],
    tosNotes: 'Reddit public RSS is allowed under Reddit API ToS for non-commercial aggregation. Atom feed does not require authentication.',
    status: 'approved',
    auditDate: '2026-05-01',
    auditedBy: 'DealRadar pipeline v3',
  },
  // All other reddit.com sources share the same policy:
  {
    sourceId: 'r_deals', domain: 'reddit.com', robotsAllowedPaths: ['/r/'],
    tosNotes: 'Same policy as r_buildapcsales.',
    status: 'approved', auditDate: '2026-05-01', auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'r_techdeals', domain: 'reddit.com', robotsAllowedPaths: ['/r/'],
    tosNotes: 'Same policy as r_buildapcsales.',
    status: 'approved', auditDate: '2026-05-01', auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'r_laptopdeals', domain: 'reddit.com', robotsAllowedPaths: ['/r/'],
    tosNotes: 'Same policy as r_buildapcsales.',
    status: 'approved', auditDate: '2026-05-01', auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'r_appledeals', domain: 'reddit.com', robotsAllowedPaths: ['/r/'],
    tosNotes: 'Same policy as r_buildapcsales.',
    status: 'approved', auditDate: '2026-05-01', auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'r_GameDeals', domain: 'reddit.com', robotsAllowedPaths: ['/r/'],
    tosNotes: 'Same policy as r_buildapcsales.',
    status: 'approved', auditDate: '2026-05-01', auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'r_PS5Deals', domain: 'reddit.com', robotsAllowedPaths: ['/r/'],
    tosNotes: 'Same policy as r_buildapcsales.',
    status: 'approved', auditDate: '2026-05-01', auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'r_xboxdeals', domain: 'reddit.com', robotsAllowedPaths: ['/r/'],
    tosNotes: 'Same policy as r_buildapcsales.',
    status: 'approved', auditDate: '2026-05-01', auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'r_frugal', domain: 'reddit.com', robotsAllowedPaths: ['/r/'],
    tosNotes: 'Same policy as r_buildapcsales.',
    status: 'approved', auditDate: '2026-05-01', auditedBy: 'DealRadar pipeline v3',
  },
  {
    sourceId: 'dealmoon',
    domain: 'dealmoon.com',
    robotsAllowedPaths: [],
    tosNotes: 'robots.txt checked 2026-05-01: Disallow: /deal/ for non-specified bots. ToS under review — scraping not explicitly permitted. BLOCKED for production until legal review complete.',
    status: 'poc_only',
    auditDate: '2026-05-01',
    auditedBy: 'DealRadar pipeline v3',
  },
];

// ─── robots.txt cache (in-memory per pipeline run) ───────────────────────────

interface RobotsEntry {
  allowed: boolean;
  cachedAt: number;
}

const robotsCache = new Map<string, RobotsEntry>();
const ROBOTS_TTL_MS = 60 * 60 * 1000; // 1 hour (within single long run)
const FETCH_TIMEOUT_MS = 8_000;

const BOT_UA = 'DealRadarBot/1.0 (+https://dealradar.netlify.app)';

async function fetchRobotsTxt(domain: string): Promise<string> {
  try {
    const res = await fetch(`https://${domain}/robots.txt`, {
      headers: { 'User-Agent': BOT_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

function isPathAllowed(robotsTxt: string, path: string, ua: string = 'DealRadarBot'): boolean {
  if (!robotsTxt) return true; // assume allowed if robots.txt unreachable
  const lines = robotsTxt.split('\n').map(l => l.trim());
  let inScope = false;
  const disallowed: string[] = [];

  for (const line of lines) {
    if (line.toLowerCase().startsWith('user-agent:')) {
      const agent = line.split(':')[1]?.trim() ?? '';
      inScope = agent === '*' || ua.toLowerCase().includes(agent.toLowerCase());
      if (inScope) disallowed.length = 0; // reset for this agent block
    } else if (inScope && line.toLowerCase().startsWith('disallow:')) {
      const p = line.split(':')[1]?.trim() ?? '';
      if (p) disallowed.push(p);
    }
  }

  return !disallowed.some(d => path.startsWith(d));
}

/**
 * Returns true if the given URL path is allowed by the domain's robots.txt.
 * Uses in-memory cache; safe to call per source per pipeline run.
 */
export async function checkRobotsAllowed(domain: string, path: string): Promise<boolean> {
  const cacheKey = `${domain}:${path}`;
  const cached = robotsCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < ROBOTS_TTL_MS) return cached.allowed;

  const txt = await fetchRobotsTxt(domain);
  const allowed = isPathAllowed(txt, path);
  robotsCache.set(cacheKey, { allowed, cachedAt: Date.now() });
  return allowed;
}

/** Quick lookup: is this sourceId in the static audit list and approved? */
export function isSourceAuditApproved(sourceId: string): boolean {
  const record = SOURCE_AUDIT.find(a => a.sourceId === sourceId);
  return record?.status === 'approved';
}
