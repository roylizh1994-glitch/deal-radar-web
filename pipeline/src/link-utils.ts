/**
 * Link utilities: short URL expansion + live verification
 * P1-2 + P1-3 implementation
 */

const SHORT_DOMAINS: Record<string, string> = {
  'a.co': 'https://www.amazon.com/',
  'amzn.com': 'https://www.amazon.com/',
  'amzn.to': 'https://www.amazon.com/',
  'bit.ly': 'https://bitly.com/',
  'tinyurl.com': 'https://tinyurl.com/',
  'ow.ly': 'https://ow.ly/',
  't.co': 'https://twitter.com/',
  'goo.gl': 'https://goo.gl/',
};

/**
 * Expand a short URL to its final destination via redirect following.
 * Returns the final URL, or the original if expansion fails.
 */
export async function expandShortUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    });
    // fetch with follow already resolves to final URL
    return res.url || url;
  } catch {
    return url; // fallback to original
  }
}

/**
 * Check if URL is a known short domain
 */
export function isShortUrl(url: string): boolean {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return domain in SHORT_DOMAINS || /^(a\.co|amzn\.com|amzn\.to|bit\.ly|t\.co)$/.test(domain);
  } catch {
    return false;
  }
}

/**
 * Verify deal URL is live (returns 200-399)
 * Uses expanded URL for short links.
 */
export async function verifyDealLink(url: string): Promise<{ ok: boolean; final_url: string; status?: number }> {
  let targetUrl = url;

  // Expand short URLs first
  if (isShortUrl(url)) {
    targetUrl = await expandShortUrl(url);
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    });
    if (res.status < 400) {
      return { ok: true, final_url: targetUrl, status: res.status };
    }
    return { ok: false, final_url: targetUrl, status: res.status };
  } catch {
    return { ok: false, final_url: targetUrl };
  }
}

/**
 * Batch verify URLs sequentially with limited concurrency (max 3)
 * Memory-efficient: no parallel promises kept in memory
 */
export async function verifyDealLinks(urls: string[], concurrency = 3): Promise<Map<string, { ok: boolean; final_url: string; status?: number }>> {
  const results = new Map<string, { ok: boolean; final_url: string; status?: number }>();
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(url => verifyDealLink(url)));
    batch.forEach((url, j) => results.set(url, batchResults[j]));
  }
  return results;
}

/**
 * Extract domain from URL for source classification
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'unknown';
  }
}
