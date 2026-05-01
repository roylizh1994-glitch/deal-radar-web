/**
 * RSS Pipeline — zero API keys required.
 * Run: npx tsx src/run-rss-pipeline.ts
 *
 * Flow: Fetch RSS → Parse deals → Quality gate → Dedupe → Score → Publish
 * Output: homepage.json + qa_report.json written to the frontend data directory.
 *
 * v3: connector plugin architecture (source-registry.ts), per-source QA stats.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { fetchAllFeeds } from './rss-fetcher.js';
import { parseRssItems } from './deal-parser.js';
import { runGateOnBatch } from './quality-gate.js';
import { deduplicate, computeCompositeScore } from './dedupe.js';
import { decidePublishSync } from './publish-fallback.js';
import { getActiveSources, SOURCES } from './source-registry.js';
import type { SourceFetchStats } from './rss-fetcher.js';
import type { RawDeal } from './quality-gate.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const FRONTEND_DATA_DIR = process.env.DEAL_DATA_DIR
  ? resolve(process.env.DEAL_DATA_DIR)
  : resolve(process.cwd(), '../data');
const FALLBACK_DATA_DIR = resolve(process.cwd(), 'output');

const SOURCE_TRUST: Record<string, number> = {
  'amazon.com': 1.0, 'bestbuy.com': 0.95, 'walmart.com': 0.90,
  'target.com': 0.90, 'newegg.com': 0.85, 'bhphotovideo.com': 0.85,
  'apple.com': 0.95, 'dell.com': 0.90, 'slickdeals.net': 0.70,
  'woot.com': 0.75, 'microcenter.com': 0.85, 'ebay.com': 0.65,
  'adorama.com': 0.80, 'bensbargains.net': 0.65, 'dealnews.com': 0.70,
};

function getSourceTrust(source: string): number {
  const host = source.toLowerCase().replace(/^www\./, '');
  return SOURCE_TRUST[host] ?? 0.50;
}

function calcFieldCompleteness(deal: any): number {
  let filled = 0;
  const total = 6;
  if (deal.title && deal.title !== 'Unknown Product') filled++;
  if (deal.brand && deal.brand !== 'Unknown') filled++;
  if (deal.category && deal.category !== 'Other') filled++;
  if (deal.price_current > 0) filled++;
  if (deal.deal_url) filled++;
  if (deal.source) filled++;
  return filled / total;
}

function ensureDir(dir: string): string {
  if (existsSync(dir)) return dir;
  if (existsSync(FALLBACK_DATA_DIR)) return FALLBACK_DATA_DIR;
  mkdirSync(FALLBACK_DATA_DIR, { recursive: true });
  return FALLBACK_DATA_DIR;
}

// ─── Per-source qualified stats ───────────────────────────────────────────────

interface SourceQaStat {
  source_name: string;
  tier: number;
  weight: number;
  raw_count: number;
  qualified_count: number;
  qualified_rate: number;
  publish_count: number;
  fetch_success: boolean;
  fetch_duration_ms: number;
  circuit_tripped: boolean;
  error?: string;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   DealRadar RSS Pipeline  v3.0       ║');
  console.log('╚══════════════════════════════════════╝\n');

  const activeSources = getActiveSources();
  console.log(`Active sources: ${activeSources.length} / ${SOURCES.length} total`);
  const pocSources = SOURCES.filter(s => !s.enabled || s.complianceStatus !== 'approved');
  if (pocSources.length > 0) {
    console.log(`  Skipped (disabled/poc_only): ${pocSources.map(s => s.id).join(', ')}`);
  }
  console.log();

  // Step 1: Fetch all RSS feeds
  console.log('Step 1: Fetching RSS feeds...');
  const { items: rssItems, sourceStats } = await fetchAllFeeds(activeSources);
  const successCount = sourceStats.filter(s => s.success).length;
  console.log(`  Sources: ${successCount}/${activeSources.length} succeeded`);
  console.log(`  Total RSS items: ${rssItems.length}\n`);

  // Step 2: Pre-filter RSS items then parse
  console.log('Step 2: Parsing deals...');
  const DEAL_KW = /\b(deal|sale|discount|off|save|score|grab|priced?|from \$|at \$|just \$|\$\d+|low|save)\b/i;
  const NEWS_KW = /\b(leak|rumor|roundup|review|announce|official|launch|hands.?on|look at|report|preview)\b/i;

  const filteredItems = rssItems.filter(item => {
    const src = activeSources.find(s => s.id === item.sourceId);
    if (src?.titleFilter === 'deal_keyword') {
      return DEAL_KW.test(item.title) && !NEWS_KW.test(item.title);
    }
    return true;
  });
  const rawDeals = parseRssItems(filteredItems);
  console.log(`  RSS items after filter: ${filteredItems.length}  →  Parsed deals: ${rawDeals.length}\n`);

  // Step 3: Quality gate
  console.log('Step 3: Running quality gate...');
  const { results: gateResults, summary: gateSummary } = runGateOnBatch(rawDeals);
  const qualified = gateResults.filter(r => r.passed).map(r => r.normalized!).filter(Boolean);
  console.log(`  Passed: ${gateSummary.passed}/${gateSummary.total} (${(gateSummary.qualified_rate * 100).toFixed(0)}%)`);
  if (gateSummary.error_breakdown.length > 0) {
    for (const err of gateSummary.error_breakdown.slice(0, 5)) {
      console.log(`  ${err.code}: ${err.count} — ${err.reason}`);
    }
  }
  console.log();

  // Step 4: Deduplicate
  console.log('Step 4: Deduplicating...');
  const dedupResult = deduplicate(qualified);
  const deduped = dedupResult.deduped_list;
  console.log(`  After dedup: ${deduped.length} (dropped ${dedupResult.dropped_duplicates} duplicates)\n`);

  // Step 5: Score
  console.log('Step 5: Computing scores...');
  for (const deal of deduped) {
    const hasAtl = /\b(all.?time\s*low|historic\s*(low|price)|record\s*low|best\s*price\s*ever)\b/i.test(deal.title);
    const discountComponent = deal.discount_pct > 0
      ? Math.min(deal.discount_pct, 0.6) * (0.40 / 0.60)
      : hasAtl ? 0.10 : 0;

    const savingsAbs = Math.max(0, deal.price_original - deal.price_current);
    const savingsComponent = savingsAbs > 0
      ? Math.min(Math.log10(savingsAbs + 1) / Math.log10(101), 1) * 0.20
      : 0;

    const sourceTrustComponent = getSourceTrust(deal.source) * 0.20;
    deal.score = 0.20 + discountComponent + savingsComponent + sourceTrustComponent;

    // Apply source weight from registry
    const srcCfg = activeSources.find(s => s.name === deal.feed_name);
    if (srcCfg && srcCfg.weight !== 1.0) {
      deal.score = Math.min(1.0, deal.score * srcCfg.weight);
    }

    const trust = getSourceTrust(deal.source);
    const composite = computeCompositeScore(deal, {
      field_completeness: calcFieldCompleteness(deal),
      price_history_sample_count: 0,
      source_trust_level: trust,
      recent_fetch_success_rate: 0.95,
    });
    deal.confidence_score = Math.max(composite, deal.confidence_score * 0.5);
  }
  deduped.sort((a, b) =>
    (b.score * b.confidence_score * (b.freshness_score ?? 0.5)) -
    (a.score * a.confidence_score * (a.freshness_score ?? 0.5))
  );
  console.log(`  Top deal: "${deduped[0]?.title ?? '(none)'}"\n`);

  // Step 6: Build per-category top-10 + global top-10
  console.log('Step 6: Building category top-10 lists...');

  const MAX_PER_CAT = 10;
  const MAX_GLOBAL  = 10;

  const categoryBuckets = new Map<string, typeof deduped>();
  for (const deal of deduped) {
    const cat = deal.category;
    if (!categoryBuckets.has(cat)) categoryBuckets.set(cat, []);
    const bucket = categoryBuckets.get(cat)!;
    if (bucket.length < MAX_PER_CAT) bucket.push(deal);
  }

  const allPublished = deduped.filter(d =>
    (categoryBuckets.get(d.category) ?? []).includes(d)
  );
  const globalTop10 = allPublished.slice(0, MAX_GLOBAL);
  const totalPublished = allPublished.length;
  const activeCats = categoryBuckets.size;

  const mode = totalPublished >= MAX_GLOBAL ? 'FULL_PUBLISH' : 'PARTIAL_PUBLISH';
  const banner = mode === 'PARTIAL_PUBLISH'
    ? `今日共 ${totalPublished} 条通过质量门槛，覆盖 ${activeCats} 个品类`
    : null;

  console.log(`  Mode: ${mode}`);
  console.log(`  Total published: ${totalPublished} across ${activeCats} categories`);
  for (const [cat, items] of categoryBuckets) {
    console.log(`    ${cat}: ${items.length}`);
  }
  console.log();

  // Step 7: Write homepage.json
  const dataDir = ensureDir(FRONTEND_DATA_DIR);
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  function serializeDeal(deal: typeof deduped[0], rank: number) {
    return {
      rank, id: deal.id, title: deal.title, brand: deal.brand, model: deal.model,
      category: deal.category, source: deal.source,
      price_current: deal.price_current, price_original: deal.price_original,
      discount_pct: Math.round(deal.discount_pct * 100),
      score: Math.round(deal.score * 100) / 100,
      confidence_score: Math.round(deal.confidence_score * 100) / 100,
      deal_url: deal.deal_url,
      verified_at: nowIso,
    };
  }

  const categoryMap: Record<string, ReturnType<typeof serializeDeal>[]> = {};
  for (const [cat, items] of categoryBuckets) {
    categoryMap[cat] = items.map((d, i) => serializeDeal(d, i + 1));
  }

  const homepagePayload = {
    generated_at: nowIso,
    date: today,
    mode,
    banner,
    items: globalTop10.map((d, i) => serializeDeal(d, i + 1)),
    categories: categoryMap,
    category_counts: Object.fromEntries(
      [...categoryBuckets.entries()].map(([cat, items]) => [cat, items.length])
    ),
  };

  const outPath = join(dataDir, 'homepage.json');
  writeFileSync(outPath, JSON.stringify(homepagePayload, null, 2));
  console.log(`Step 7: Written → ${outPath}`);

  const archivePath = join(dataDir, `homepage-${today}.json`);
  writeFileSync(archivePath, JSON.stringify(homepagePayload, null, 2));
  console.log(`        Archive → ${archivePath}`);

  // Step 8: Build per-source stats
  const publishedFeedNames = new Set(allPublished.map(d => d.feed_name));

  // raw count per source from rssItems
  const rawBySource = new Map<string, number>();
  for (const item of rssItems) {
    rawBySource.set(item.sourceId, (rawBySource.get(item.sourceId) ?? 0) + 1);
  }
  // qualified count per source
  const qualBySource = new Map<string, number>();
  for (const r of gateResults) {
    if (r.passed && r.normalized) {
      const sid = r.normalized.feed_name ?? '__unknown__';
      qualBySource.set(sid, (qualBySource.get(sid) ?? 0) + 1);
    }
  }
  // publish count per source (how many in allPublished came from this source)
  const pubBySource = new Map<string, number>();
  for (const d of allPublished) {
    const fn = d.feed_name ?? '__unknown__';
    pubBySource.set(fn, (pubBySource.get(fn) ?? 0) + 1);
  }

  const sourceQaStats: SourceQaStat[] = sourceStats.map(ss => {
    const cfg = activeSources.find(s => s.id === ss.sourceId);
    const rawCount = rawBySource.get(ss.sourceId) ?? 0;
    const qualCount = qualBySource.get(ss.sourceName) ?? 0;
    const pubCount  = pubBySource.get(ss.sourceName) ?? 0;
    return {
      source_name: ss.sourceName,
      tier: ss.tier,
      weight: cfg?.weight ?? 1.0,
      raw_count: rawCount,
      qualified_count: qualCount,
      qualified_rate: rawCount > 0 ? Math.round((qualCount / rawCount) * 1000) / 1000 : 0,
      publish_count: pubCount,
      fetch_success: ss.success,
      fetch_duration_ms: ss.durationMs,
      circuit_tripped: ss.circuitTripped,
      ...(ss.error ? { error: ss.error } : {}),
    };
  });

  // Step 9: Write QA report
  const rejectBreakdown = gateSummary.error_breakdown.slice(0, 5).map(e => ({
    code: e.code, reason: e.reason, count: e.count,
  }));

  const qaReport = {
    generated_at: nowIso,
    date: today,
    pipeline_version: '3.0',
    // ── Global stats ──
    sources_active: activeSources.length,
    sources_succeeded: sourceStats.filter(s => s.success).length,
    sources_failed: sourceStats.filter(s => !s.success && !s.circuitTripped).length,
    sources_circuit_tripped: sourceStats.filter(s => s.circuitTripped).length,
    raw_count: rssItems.length,
    filtered_count: filteredItems.length,
    parsed_count: rawDeals.length,
    qualified_count: gateSummary.passed,
    deduped_count: deduped.length,
    published_count: totalPublished,
    active_categories: activeCats,
    category_counts: homepagePayload.category_counts,
    qualified_rate: Math.round(gateSummary.qualified_rate * 1000) / 1000,
    duplicate_ratio: rawDeals.length > 0
      ? Math.round((dedupResult.dropped_duplicates / rawDeals.length) * 1000) / 1000
      : 0,
    broken_link_ratio: 0,
    publish_mode: mode,
    reject_reason_top5: rejectBreakdown,
    sample_rejects: gateSummary.sample_rejects.slice(0, 5),
    // ── Per-source breakdown ──
    source_stats: sourceQaStats,
    // ── Disabled / PoC sources (for audit trail) ──
    sources_skipped: SOURCES
      .filter(s => !s.enabled || s.complianceStatus !== 'approved')
      .map(s => ({ id: s.id, name: s.name, reason: s.complianceStatus, note: s.complianceNote })),
  };

  const qaPath = join(dataDir, 'qa_report.json');
  writeFileSync(qaPath, JSON.stringify(qaReport, null, 2));
  console.log(`        QA report → ${qaPath}\n`);

  // Print per-source summary
  console.log('Source contribution summary:');
  for (const s of sourceQaStats.sort((a, b) => b.publish_count - a.publish_count)) {
    const status = s.circuit_tripped ? '⚡TRIPPED' : s.fetch_success ? '✓' : '✗';
    console.log(`  ${status} ${s.source_name.padEnd(24)} raw=${s.raw_count} qual=${s.qualified_count} pub=${s.publish_count}`);
  }
  console.log();
  console.log('✅ Pipeline complete.\n');
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
