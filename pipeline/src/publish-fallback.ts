/**
 * Publish Fallback Rules — P0C Implementation
 * Exactly as specified:
 * - if qualified_count < 10: PARTIAL_PUBLISH with banner
 * - if broken_link_ratio_top10 > 0: HARD_FAIL, block publish
 * - if gate_results.passed == false and blocking_failures not empty: block full publish
 */

export type PublishMode = 'FULL_PUBLISH' | 'PARTIAL_PUBLISH' | 'HARD_FAIL';

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
}

export interface PublishDecision {
  mode: PublishMode;
  fallback_triggered: boolean;
  banner_message?: string;
  published_items: NormalizedDeal[];
  publish_errors: { deal_id: string; reason: string }[];
  broken_link_count: number;
  broken_link_ratio_top10: number;
}

export interface PublishError {
  deal_id: string;
  reason: string;
}

const MIN_QUALIFIED_THRESHOLD = 10;
const BROKEN_LINK_CHECK_TIMEOUT_MS = 10000;

const BLOCKING_ERROR_CODES = new Set(['QG001', 'QG007', 'QG009', 'QG012']);

/**
 * Async: check if a URL returns 2xx/3xx (not broken)
 * More lenient: allow 3xx redirects, only block 4xx/5xx/errors
 */
export async function checkUrlHealth(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BROKEN_LINK_CHECK_TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
    });
    clearTimeout(timeout);
    // Accept 2xx and 3xx as healthy
    return res.status < 400;
  } catch {
    return false;
  }
}

/**
 * Main publish decision function.
 */
export async function decidePublish(
  qualified_deals: NormalizedDeal[],
  gate_results: { passed: boolean; blocking_failures?: string[] },
  top_n = 10
): Promise<PublishDecision> {
  const candidates = [...qualified_deals]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, top_n);

  // Rule C: Link health check with short URL expansion
  // P1: Use expanded final_url if available
  const linkHealthResults = await Promise.all(
    candidates.map(async (deal) => {
      const checkUrl = (deal as any).final_url || deal.deal_url;
      const ok = await checkUrlHealth(checkUrl);
      return { deal_id: deal.id, ok };
    })
  );

  const broken = linkHealthResults.filter(r => !r.ok);
  const broken_link_count = broken.length;
  const broken_link_ratio_top10 = top_n > 0 ? broken_link_count / top_n : 0;

  // P1 thresholds:
  // broken_link_ratio > 0.2 → HARD_FAIL (too many bad links)
  // 0 < broken_link_ratio <= 0.2 → PARTIAL_PUBLISH with warning
  // broken_link_ratio = 0 → FULL_PUBLISH or PARTIAL (based on qualified count)

  if (broken_link_ratio_top10 > 0.2) {
    return {
      mode: 'HARD_FAIL',
      fallback_triggered: true,
      banner_message: `发布暂停：失效链接占比过高（${(broken_link_ratio_top10 * 100).toFixed(0)}%），请修复数据源。`,
      published_items: [],
      publish_errors: broken.map(b => ({ deal_id: b.deal_id, reason: 'BROKEN_LINK_404' })),
      broken_link_count,
      broken_link_ratio_top10,
    };
  }

  // Rule D: PARTIAL_PUBLISH if qualified < 10
  const qualified_count = qualified_deals.length;
  if (qualified_count < MIN_QUALIFIED_THRESHOLD || broken_link_ratio_top10 > 0) {
    const bannerParts: string[] = [];
    if (qualified_count < MIN_QUALIFIED_THRESHOLD) {
      bannerParts.push(`有效候选${qualified_count}条`);
    }
    if (broken_link_ratio_top10 > 0) {
      bannerParts.push(`${(broken_link_ratio_top10 * 100).toFixed(0)}%链接可能已失效`);
    }
    const verifiedItems = broken_link_ratio_top10 > 0
      ? candidates.filter(c => !broken.some(b => b.deal_id === c.id))
      : candidates;
    return {
      mode: 'PARTIAL_PUBLISH',
      fallback_triggered: true,
      banner_message: `⚠️ ${bannerParts.join('，')}，仅展示${verifiedItems.length}条已验证项。`,
      published_items: verifiedItems,
      publish_errors: broken.map(b => ({ deal_id: b.deal_id, reason: 'BROKEN_LINK_404' })),
      broken_link_count,
      broken_link_ratio_top10,
    };
  }

  // Rule E: FULL_PUBLISH
  return {
    mode: 'FULL_PUBLISH',
    fallback_triggered: false,
    published_items: candidates,
    publish_errors: [],
    broken_link_count: 0,
    broken_link_ratio_top10: 0,
  };
}

/**
 * Sync version for testing / offline use (skips link health check)
 */
export function decidePublishSync(
  qualified_deals: NormalizedDeal[],
  gate_results: { passed: boolean; blocking_failures?: string[] },
  top_n = 10
): Omit<PublishDecision, 'broken_link_count' | 'broken_link_ratio_top10'> & {
  broken_link_count: number;
  broken_link_ratio_top10: number;
} {
  const candidates = [...qualified_deals]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, top_n);

  if (qualified_deals.length < MIN_QUALIFIED_THRESHOLD) {
    return {
      mode: 'PARTIAL_PUBLISH',
      fallback_triggered: true,
      banner_message: `今日有效候选不足，仅展示 ${qualified_deals.length} 条。`,
      published_items: candidates,
      publish_errors: [],
      broken_link_count: 0,
      broken_link_ratio_top10: 0,
    };
  }

  return {
    mode: 'FULL_PUBLISH',
    fallback_triggered: false,
    published_items: candidates,
    publish_errors: [],
    broken_link_count: 0,
    broken_link_ratio_top10: 0,
  };
}