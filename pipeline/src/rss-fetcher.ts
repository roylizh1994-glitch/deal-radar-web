/**
 * RSS Fetcher — no API keys required.
 * Handles both RSS 2.0 (<item>) and Atom (<entry>) formats.
 */

export interface RssItem {
  title: string;
  link: string;
  description: string;  // raw HTML/text content
  pubDate: string;
  feedName: string;
  sourceTier: 2 | 3;
}

export interface RssFeed {
  url: string;
  name: string;
  tier: 2 | 3;
}

export const RSS_FEEDS: RssFeed[] = [
  // Tier-2: curated deal aggregators (direct links, no age limit)
  {
    url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1',
    name: 'Slickdeals Frontpage',
    tier: 2,
  },
  // 9to5Toys: Apple/tech deals, links to 9to5toys.com articles
  {
    url: 'https://9to5toys.com/feed/',
    name: '9to5Toys',
    tier: 2,
  },

  // Tier-3: Reddit community posts — use new.rss for maximum freshness
  { url: 'https://www.reddit.com/r/buildapcsales/new.rss', name: 'r/buildapcsales', tier: 3 },
  { url: 'https://www.reddit.com/r/deals/new.rss',         name: 'r/deals',         tier: 3 },
  { url: 'https://www.reddit.com/r/techdeals/new.rss',     name: 'r/techdeals',     tier: 3 },
];

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 15_000;

// ─── XML helpers ─────────────────────────────────────────────────────────────

function extractCdata(raw: string): string {
  const m = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? m[1].trim() : raw.trim();
}

function getTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? extractCdata(m[1].trim()) : '';
}

// Atom: <link rel="alternate" href="URL"/> or <link href="URL"/>
function getAtomLink(xml: string): string {
  // Prefer rel="alternate"
  const altM = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (altM) return altM[1];
  const hrefM = xml.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (hrefM) return hrefM[1];
  // RSS 2.0 plain link
  const plainM = xml.match(/<link>([^<]+)<\/link>/i);
  if (plainM) return plainM[1].trim();
  return '';
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#32;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

function parseRssItems(xml: string, feedName: string, tier: 2 | 3): RssItem[] {
  const items: RssItem[] = [];
  const parts = xml.split(/<item[\s>]/i);
  for (let i = 1; i < parts.length; i++) {
    const end = parts[i].indexOf('</item>');
    const body = end >= 0 ? parts[i].slice(0, end) : parts[i];
    const title = getTag(body, 'title');
    const link  = getAtomLink(body) || getTag(body, 'guid');
    const desc  = getTag(body, 'description');
    const pub   = getTag(body, 'pubDate') || getTag(body, 'dc:date');
    if (!title || !link) continue;
    items.push({ title, link, description: desc, pubDate: pub, feedName, sourceTier: tier });
  }
  return items;
}

function parseAtomEntries(xml: string, feedName: string, tier: 2 | 3): RssItem[] {
  const items: RssItem[] = [];
  const parts = xml.split(/<entry[\s>]/i);
  for (let i = 1; i < parts.length; i++) {
    const end = parts[i].indexOf('</entry>');
    const body = end >= 0 ? parts[i].slice(0, end) : parts[i];
    const title = getTag(body, 'title');
    const link  = getAtomLink(body);
    // Atom content may be HTML-encoded — decode for merchant URL extraction
    const rawContent = getTag(body, 'content') || getTag(body, 'summary');
    const desc = decodeHtmlEntities(rawContent);
    const pub   = getTag(body, 'updated') || getTag(body, 'published');
    if (!title || !link) continue;
    items.push({ title, link, description: desc, pubDate: pub, feedName, sourceTier: tier });
  }
  return items;
}

function parseXml(xml: string, feedName: string, tier: 2 | 3): RssItem[] {
  const isAtom = xml.includes('<feed') && xml.includes('<entry');
  return isAtom
    ? parseAtomEntries(xml, feedName, tier)
    : parseRssItems(xml, feedName, tier);
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

export async function fetchFeed(feed: RssFeed): Promise<RssItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'application/atom+xml,application/rss+xml,application/xml,text/xml,*/*',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[rss] ${feed.name}: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = parseXml(xml, feed.name, feed.tier);
    console.log(`[rss] ${feed.name}: ${items.length} items`);
    return items;
  } catch (e: any) {
    console.warn(`[rss] ${feed.name}: ${e.message}`);
    return [];
  }
}

export async function fetchAllFeeds(feeds: RssFeed[] = RSS_FEEDS): Promise<RssItem[]> {
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const all: RssItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  return all;
}
