/**
 * RSS Fetcher — no API keys required.
 * Handles both RSS 2.0 (<item>) and Atom (<entry>) formats.
 *
 * v3: connector plugin architecture with retry, circuit breaker, rate limiting.
 * Sources are driven by source-registry.ts; no hard-coded feed list here.
 */

import type { SourceConfig } from './source-registry.js';
import { getActiveSources, toLegacyFeed } from './source-registry.js';

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  feedName: string;
  sourceTier: 2 | 3;
  sourceId: string;    // matches SourceConfig.id
  sourceWeight: number;
}

/** Per-source fetch statistics (emitted to qa_report). */
export interface SourceFetchStats {
  sourceId: string;
  sourceName: string;
  tier: number;
  success: boolean;
  itemCount: number;
  durationMs: number;
  error?: string;
  circuitTripped: boolean;
}

// Legacy shape for backward compatibility with callers that use RssFeed directly.
export interface RssFeed {
  url: string;
  name: string;
  tier: 2 | 3;
}

// ─── Retry / circuit breaker ─────────────────────────────────────────────────

const FETCH_TIMEOUT_MS   = 15_000;
const MAX_RETRIES        = 2;
const RETRY_BASE_MS      = 800;   // 800ms, 1600ms
const CIRCUIT_THRESHOLD  = 5;     // consecutive failures before tripping
const RATE_LIMIT_MS      = 1_000; // min gap between requests to same domain

const consecutiveFailures = new Map<string, number>(); // sourceId → count
const lastRequestTime     = new Map<string, number>(); // domain → timestamp

function domain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

async function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function rateLimitedFetch(url: string, opts: RequestInit): Promise<Response> {
  const dom = domain(url);
  const last = lastRequestTime.get(dom) ?? 0;
  const gap = Date.now() - last;
  if (gap < RATE_LIMIT_MS) await wait(RATE_LIMIT_MS - gap);
  lastRequestTime.set(dom, Date.now());
  return fetch(url, opts);
}

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchWithRetry(url: string): Promise<string> {
  let lastErr: Error = new Error('unknown');
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await wait(RETRY_BASE_MS * attempt);
    try {
      const res = await rateLimitedFetch(url, {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'application/atom+xml,application/rss+xml,application/xml,text/xml,*/*',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr;
}

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

function getAtomLink(xml: string): string {
  const altM = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (altM) return altM[1];
  const hrefM = xml.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (hrefM) return hrefM[1];
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

function parseRssItems(xml: string, source: SourceConfig): RssItem[] {
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
    items.push({
      title, link, description: desc, pubDate: pub,
      feedName: source.name, sourceTier: source.tier as 2 | 3,
      sourceId: source.id, sourceWeight: source.weight,
    });
  }
  return items;
}

function parseAtomEntries(xml: string, source: SourceConfig): RssItem[] {
  const items: RssItem[] = [];
  const parts = xml.split(/<entry[\s>]/i);
  for (let i = 1; i < parts.length; i++) {
    const end = parts[i].indexOf('</entry>');
    const body = end >= 0 ? parts[i].slice(0, end) : parts[i];
    const title = getTag(body, 'title');
    const link  = getAtomLink(body);
    const rawContent = getTag(body, 'content') || getTag(body, 'summary');
    const desc = decodeHtmlEntities(rawContent);
    const pub  = getTag(body, 'updated') || getTag(body, 'published');
    if (!title || !link) continue;
    items.push({
      title, link, description: desc, pubDate: pub,
      feedName: source.name, sourceTier: source.tier as 2 | 3,
      sourceId: source.id, sourceWeight: source.weight,
    });
  }
  return items;
}

function parseXml(xml: string, source: SourceConfig): RssItem[] {
  const isAtom = xml.includes('<feed') && xml.includes('<entry');
  return isAtom ? parseAtomEntries(xml, source) : parseRssItems(xml, source);
}

// ─── Fetch one source ────────────────────────────────────────────────────────

export async function fetchSource(source: SourceConfig): Promise<{
  items: RssItem[];
  stats: SourceFetchStats;
}> {
  const t0 = Date.now();
  const stats: SourceFetchStats = {
    sourceId: source.id,
    sourceName: source.name,
    tier: source.tier,
    success: false,
    itemCount: 0,
    durationMs: 0,
    circuitTripped: false,
  };

  // Circuit breaker: skip if too many consecutive failures
  const failures = consecutiveFailures.get(source.id) ?? 0;
  if (failures >= CIRCUIT_THRESHOLD) {
    stats.circuitTripped = true;
    stats.error = `Circuit tripped after ${failures} consecutive failures`;
    stats.durationMs = Date.now() - t0;
    console.warn(`[fetch] CIRCUIT TRIPPED: ${source.name} (${failures} failures) — skipping`);
    return { items: [], stats };
  }

  try {
    const xml = await fetchWithRetry(source.url);
    const items = parseXml(xml, source);
    consecutiveFailures.set(source.id, 0); // reset on success
    stats.success = true;
    stats.itemCount = items.length;
    stats.durationMs = Date.now() - t0;
    console.log(`[fetch] ${source.name}: ${items.length} items (${stats.durationMs}ms)`);
    return { items, stats };
  } catch (e: any) {
    const newFailures = failures + 1;
    consecutiveFailures.set(source.id, newFailures);
    stats.error = e.message;
    stats.durationMs = Date.now() - t0;
    if (newFailures >= CIRCUIT_THRESHOLD) {
      console.warn(`[fetch] ${source.name}: TRIPPED circuit after ${newFailures} failures`);
    } else {
      console.warn(`[fetch] ${source.name}: ${e.message} (failure ${newFailures}/${CIRCUIT_THRESHOLD})`);
    }
    return { items: [], stats };
  }
}

// ─── Fetch all active sources ─────────────────────────────────────────────────

export async function fetchAllFeeds(
  overrideSources?: SourceConfig[]
): Promise<{ items: RssItem[]; sourceStats: SourceFetchStats[] }> {
  const sources = overrideSources ?? getActiveSources();
  const results = await Promise.allSettled(sources.map(fetchSource));

  const allItems: RssItem[] = [];
  const sourceStats: SourceFetchStats[] = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      allItems.push(...r.value.items);
      sourceStats.push(r.value.stats);
    }
  }
  return { items: allItems, sourceStats };
}

// ─── Legacy API (backward compat) ────────────────────────────────────────────

/** @deprecated Use fetchAllFeeds() which returns sourceStats too. */
export async function fetchAllFeedsLegacy(feeds?: RssFeed[]): Promise<RssItem[]> {
  if (feeds) {
    // caller-provided feed list: wrap in minimal SourceConfig
    const sources: SourceConfig[] = feeds.map(f => ({
      id: f.name, name: f.name, url: f.url,
      type: 'rss' as const, tier: f.tier,
      enabled: true, weight: 1.0, intervalMinutes: 60,
      complianceStatus: 'approved' as const,
    }));
    const { items } = await fetchAllFeeds(sources);
    return items;
  }
  const { items } = await fetchAllFeeds();
  return items;
}
