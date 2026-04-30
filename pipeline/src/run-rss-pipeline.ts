/**
 * RSS Pipeline — zero API keys required.
 * Run: npx tsx src/run-rss-pipeline.ts
 *
 * Flow: Fetch RSS → Parse deals → Quality gate → Dedupe → Score → Publish
 * Output: homepage.json written to the frontend data directory.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { fetchAllFeeds } from './rss-fetcher.js';
import { parseRssItems } from './deal-parser.js';
import { runGateOnBatch } from './quality-gate.js';
import { deduplicate, computeCompositeScore } from './dedupe.js';
import { decidePublishSync } from './publish-fallback.js';

// ─── Config ──────────────────────────────────────────────────────────────────

// When running from pipeline/, ../data points to deal-radar-web/data/
// Override with DEAL_DATA_DIR env var in CI/CD environments
const FRONTEND_DATA_DIR = process.env.DEAL_DATA_DIR
  ? resolve(process.env.DEAL_DATA_DIR)
  : resolve(process.cwd(), '../data');
const FALLBACK_DATA_DIR = resolve(process.cwd(), 'output');

const SOURCE_TRUST: Record<string, number> = {
  'amazon.com': 1.0, 'bestbuy.com': 0.95, 'walmart.com': 0.90,
  'target.com': 0.90, 'newegg.com': 0.85, 'bhphotovideo.com': 0.85,
  'apple.com': 0.95, 'dell.com': 0.90, 'slickdeals.net': 0.70,
  'woot.com': 0.70, 'microcenter.com': 0.85, 'ebay.com': 0.65,
  'adorama.com': 0.80,
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
  // Try the fallback
  if (existsSync(FALLBACK_DATA_DIR)) return FALLBACK_DATA_DIR;
  // Create fallback
  mkdirSync(FALLBACK_DATA_DIR, { recursive: true });
  return FALLBACK_DATA_DIR;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════╗');
  console.log('║   DealRadar RSS Pipeline  v2.0   ║');
  console.log('╚══════════════════════════════════╝\n');

  // Step 1: Fetch all RSS feeds
  console.log('Step 1: Fetching RSS feeds...');
  const rssItems = await fetchAllFeeds();
  console.log(`  Total RSS items: ${rssItems.length}\n`);

  // Step 2: Pre-filter RSS items then parse
  console.log('Step 2: Parsing deals...');
  const filteredItems = rssItems.filter(item => {
    // 9to5Toys: skip news/rumors/roundups without a price signal
    if (item.feedName === '9to5Toys') {
      const hasDealKeyword = /\b(deal|sale|discount|off|save|score|grab|priced?|from \$|at \$|just \$|\$\d+)\b/i.test(item.title);
      const hasNewsKeyword = /\b(leak|rumor|roundup|review|announce|official|launch|hands.?on|look at|report)\b/i.test(item.title);
      return hasDealKeyword && !hasNewsKeyword;
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
    // Set base business score from discount_pct or source quality
    const discountBonus = deal.discount_pct > 0 ? Math.min(deal.discount_pct, 0.6) : 0.3;
    deal.score = 0.4 + discountBonus;  // 0.4–1.0 range

    const trust = getSourceTrust(deal.source);
    const composite = computeCompositeScore(deal, {
      field_completeness: calcFieldCompleteness(deal),
      price_history_sample_count: 0,
      source_trust_level: trust,
      recent_fetch_success_rate: 0.95,
    });
    // Keep final composite as confidence_score for display; score stays as sort key
    deal.confidence_score = Math.max(composite, deal.confidence_score * 0.5);
  }
  deduped.sort((a, b) =>
    (b.score * b.confidence_score * (b.freshness_score ?? 0.5)) -
    (a.score * a.confidence_score * (a.freshness_score ?? 0.5))
  );
  console.log(`  Top deal: "${deduped[0]?.title ?? '(none)'}"\n`);

  // Step 6: Publish decision (sync — no live link check; domain allowlist is the trust signal)
  console.log('Step 6: Publish decision...');
  const publishDecision = decidePublishSync(
    deduped,
    { passed: gateSummary.error_breakdown.length === 0, blocking_failures: [] },
    10
  );
  console.log(`  Mode: ${publishDecision.mode}`);
  console.log(`  Published: ${publishDecision.published_items.length} items`);
  if (publishDecision.banner_message) {
    console.log(`  Banner: ${publishDecision.banner_message}`);
  }
  console.log();

  // Step 7: Write homepage.json
  const dataDir = ensureDir(FRONTEND_DATA_DIR);
  const today = new Date().toISOString().slice(0, 10);

  const homepagePayload = {
    generated_at: new Date().toISOString(),
    date: today,
    mode: publishDecision.mode,
    banner: publishDecision.banner_message ?? null,
    items: publishDecision.published_items.map((deal, i) => ({
      rank: i + 1,
      id: deal.id,
      title: deal.title,
      brand: deal.brand,
      model: deal.model,
      category: deal.category,
      source: deal.source,
      price_current: deal.price_current,
      price_original: deal.price_original,
      discount_pct: Math.round(deal.discount_pct * 100),
      score: Math.round(deal.score * 100) / 100,
      confidence_score: Math.round(deal.confidence_score * 100) / 100,
      deal_url: deal.deal_url,
    })),
  };

  const outPath = join(dataDir, 'homepage.json');
  writeFileSync(outPath, JSON.stringify(homepagePayload, null, 2));
  console.log(`Step 7: Written → ${outPath}`);

  // Also write dated archive
  const archivePath = join(dataDir, `homepage-${today}.json`);
  writeFileSync(archivePath, JSON.stringify(homepagePayload, null, 2));
  console.log(`        Archive → ${archivePath}\n`);

  console.log('✅ Pipeline complete.\n');
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
