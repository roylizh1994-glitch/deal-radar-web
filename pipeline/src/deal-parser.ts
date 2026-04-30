/**
 * Deal Parser — converts RSS items into RawDeal format.
 * Handles Reddit (Atom), Slickdeals (RSS), and 9to5Toys (RSS) title formats.
 */

import type { RssItem } from './rss-fetcher.js';
import type { RawDeal } from './quality-gate.js';

// ─── Category detection ──────────────────────────────────────────────────────

// Reddit flair → category (from [TAG] prefix)
const REDDIT_FLAIR_MAP: Record<string, string> = {
  gpu: 'GPU', 'video card': 'GPU', graphics: 'GPU', 'graphics card': 'GPU',
  cpu: 'CPU', processor: 'CPU', 'desktop cpu': 'CPU',
  ssd: 'Storage', hdd: 'Storage', nvme: 'Storage', storage: 'Storage',
  'hard drive': 'Storage', 'flash drive': 'Storage', 'usb drive': 'Storage',
  monitor: 'Monitor', display: 'Monitor', 'computer monitor': 'Monitor',
  laptop: 'Laptop', notebook: 'Laptop', 'gaming laptop': 'Laptop',
  keyboard: 'Peripheral', mouse: 'Peripheral', headset: 'Peripheral',
  peripheral: 'Peripheral', controller: 'Peripheral', gamepad: 'Peripheral',
  headphone: 'Audio', earbuds: 'Audio', speaker: 'Audio', audio: 'Audio',
  airpods: 'Audio', earphones: 'Audio', soundbar: 'Audio',
  tv: 'TV', television: 'TV', 'smart tv': 'TV',
  phone: 'Phone', smartphone: 'Phone', iphone: 'Phone',
  tablet: 'Tablet', ipad: 'Tablet',
  ram: 'RAM', memory: 'RAM', dram: 'RAM',
  psu: 'PC Parts', 'power supply': 'PC Parts', motherboard: 'PC Parts',
  mobo: 'PC Parts', case: 'PC Parts', cooler: 'PC Parts',
  router: 'Networking', switch: 'Networking', networking: 'Networking',
  modem: 'Networking', wifi: 'Networking',
  smartwatch: 'Wearable', watch: 'Wearable',
  software: 'Software', game: 'Software', games: 'Software', vpn: 'Software',
  accessory: 'Accessory', cable: 'Accessory', charger: 'Accessory',
  'power bank': 'Accessory', powerbank: 'Accessory', hub: 'Accessory',
  camera: 'Camera', webcam: 'Camera',
  projector: 'Projector',
};

// Keyword patterns in title text → category (order matters: most specific first)
const TITLE_PATTERNS: [RegExp, string][] = [
  // Laptop (check before CPU to avoid "Ryzen 5 laptop" → CPU)
  [/\b(macbook|thinkpad|ideapad|yoga|inspiron|xps\s*\d|rog\s+(zephyrus|strix|flow)|gram\s*\d+|spectre|pavilion|swift\s*\d|aspire)\b/i, 'Laptop'],
  [/\b(gaming\s+laptop|laptop\b|chromebook|ultrabook|notebook)\b/i, 'Laptop'],
  // GPU
  [/\b(rtx\s*\d{3,4}|rx\s*\d{4}|gtx\s*\d{3,4}|radeon|geforce|arc\s*a\d{3})\b/i, 'GPU'],
  // CPU (only if clearly a standalone CPU, not in a laptop title)
  [/\b(ryzen\s*[357]|ryzen\s*\d|core\s*(ultra\s*)?\d|core\s*i[3579]|xeon|athlon|threadripper)\b/i, 'CPU'],
  // Storage
  [/\b(\d+\s*tb?\s*ssd|\d+\s*gb\s*ssd|nvme|m\.2\s*ssd|portable\s*ssd|ssd\s*drive|pcie\s*ssd)\b/i, 'Storage'],
  [/\b(hard\s*drive|external\s*drive|usb\s*(flash|drive)|thumb\s*drive)\b/i, 'Storage'],
  // Monitor (check before TV for inch patterns)
  [/\b(\d{2,3}"\s*(monitor|ips|ips|oled|nano|qhd|4k\s+monitor|gaming\s+monitor))\b/i, 'Monitor'],
  [/\b(gaming\s+monitor|ultrawide|curved\s+monitor|4k\s+monitor|1440p\s+monitor|165hz|144hz|240hz)\b/i, 'Monitor'],
  [/\b(monitor\b|display\b(?!\s*(port|card)))\b/i, 'Monitor'],
  // TV (check after Monitor)
  [/\b(\d{2,3}"\s*(tv|qled|oled|neo\s*qled|mini.?led|crystal|bravia|qd.?oled))\b/i, 'TV'],
  [/\b(\bsmart\s+tv\b|qled|nanocell|oled\s+tv|fire\s+tv|roku\s+tv)\b/i, 'TV'],
  // Laptop
  [/\b(macbook|thinkpad|ideapad|yoga|inspiron|xps\s*\d|rog\s+(zephyrus|strix)|gram\s*\d+|spectre|pavilion|swift|aspire)\b/i, 'Laptop'],
  [/\b(gaming\s+laptop|laptop\s*deal|chromebook|ultrabook|notebook)\b/i, 'Laptop'],
  // Audio
  [/\b(airpods|wh-\d{4,5}|wf-\d{4,5}|anc\s*headphones|noise.?canceling|noise.?cancelling)\b/i, 'Audio'],
  [/\b(earbuds|true\s*wireless|headphones|soundbar|wireless\s*speaker|bluetooth\s*speaker)\b/i, 'Audio'],
  // Phone
  [/\b(iphone\s*\d+|galaxy\s+s\d+|pixel\s+\d+|oneplus\s*\d+|moto\s+g|xiaomi|android\s*phone)\b/i, 'Phone'],
  // Tablet
  [/\b(ipad(\s*(pro|mini|air))?\b|galaxy\s+tab|surface\s*pro|kindle|e-reader|ereader)\b/i, 'Tablet'],
  // RAM
  [/\b(ddr[45][x-]?\s*\d+|sodimm|lpddr\d|cl\d+\s*ram|ram\s*kit|memory\s*upgrade)\b/i, 'RAM'],
  // PC Parts
  [/\b(motherboard|z\d{3}|b\d{3}m?\s*(plus|pro)?|psu\b|atx\s*psu|power\s*supply|cpu\s*cooler|aio\s*cooler|atx\s*case)\b/i, 'PC Parts'],
  // Peripheral
  [/\b(mechanical\s*keyboard|gaming\s*mouse|keychron|mx\s*master|g\s*pro\s*x|razer\s*(deathadder|viper|blackwidow))\b/i, 'Peripheral'],
  [/\b(wireless\s*mouse|wireless\s*keyboard|gaming\s*keyboard|mouse\s*pad|mousepad|controller\b)\b/i, 'Peripheral'],
  // Networking
  [/\b(wi.?fi\s*[67]|mesh\s*(wifi|network)|ax\d{4}|router\b|modem\b|ethernet\s*switch|poe\s*switch)\b/i, 'Networking'],
  // Wearable
  [/\b(apple\s*watch|galaxy\s*watch|fitbit|garmin\s*(forerunner|fenix)|smartwatch)\b/i, 'Wearable'],
  // Camera
  [/\b(mirrorless|dslr|action\s*cam|webcam|ring\s*light|security\s*camera|dashcam)\b/i, 'Camera'],
  // Accessory / Charging
  [/\b(power\s*bank|usb.?c\s*(hub|adapter|dock)|thunderbolt\s*dock|wireless\s*charger|magsafe|usb\s*hub)\b/i, 'Accessory'],
  [/\b(anker\s*\d{3}|baseus|iniu|belkin\s*charge|ravpower)\b/i, 'Accessory'],
  // Gaming console
  [/\b(steam\s*deck|ps5|playstation\s*5|xbox\s*(series|one|x|s)|nintendo\s*switch)\b/i, 'Gaming'],
  // Software
  [/\b(microsoft\s*365|microsoft\s*office|adobe\s*(cc|creative)|vpn\s*(subscription|deal)|antivirus)\b/i, 'Software'],
];

function classifyCategory(title: string): string {
  // 1. Check Reddit flair [TAG]
  const flairMatch = title.match(/^\[([^\]]+)\]/);
  if (flairMatch) {
    const tag = flairMatch[1].toLowerCase().trim();
    for (const [key, cat] of Object.entries(REDDIT_FLAIR_MAP)) {
      if (tag.includes(key)) return cat;
    }
  }
  // 2. Keyword scan
  for (const [re, cat] of TITLE_PATTERNS) {
    if (re.test(title)) return cat;
  }
  return 'Other';
}

// ─── Brand extraction ────────────────────────────────────────────────────────

const BRAND_LIST = [
  'Samsung', 'Apple', 'LG', 'Sony', 'ASUS', 'Asus', 'Dell', 'HP', 'Lenovo',
  'Microsoft', 'Logitech', 'Corsair', 'Razer', 'SteelSeries', 'HyperX',
  'Western Digital', 'WD_BLACK', 'WD', 'Seagate', 'Crucial', 'Kingston',
  'Sabrent', 'Micron', 'G.Skill',
  'Nvidia', 'NVIDIA', 'AMD', 'Intel', 'Qualcomm',
  'Anker', 'Belkin', 'TP-Link', 'Netgear', 'Eero', 'Orbi',
  'Bose', 'Sennheiser', 'JBL', 'Jabra', 'Beats', 'Skullcandy', 'Shokz',
  'NZXT', 'Fractal', 'Cooler Master', 'be quiet', 'Lian Li',
  'Acer', 'MSI', 'Gigabyte', 'EVGA', 'Sapphire', 'XFX',
  'Google', 'Meta', 'Oculus', 'Fitbit',
  'Keychron', 'Ducky', 'Leopold', 'GMMK',
  'LaCie', 'SanDisk', 'Samsung', 'Lexar',
  'Epson', 'Canon', 'Nikon', 'Fujifilm',
  'Netgear', 'Asus', 'Linksys', 'Ubiquiti',
  'Garmin', 'Polar',
];

function extractBrand(title: string): string {
  const lower = title.toLowerCase();
  for (const brand of BRAND_LIST) {
    if (lower.includes(brand.toLowerCase())) return brand;
  }
  // Try first capitalized word not starting with [
  const words = title.replace(/^\[[^\]]+\]\s*/, '').split(/\s+/);
  const first = words[0] ?? '';
  if (first.length > 2 && /^[A-Z]/.test(first) && !/^\d/.test(first)) return first;
  return 'Unknown';
}

// ─── Price extraction ────────────────────────────────────────────────────────

function extractPrices(text: string): { current: number; original: number | undefined } {
  // Look for patterns like "$X off" (discount amount, not the current price) to exclude them
  const offPattern = /\$[\d,]+(?:\.\d{1,2})?\s*off\b/gi;
  const withoutOff = text.replace(offPattern, '');

  // Extract all plain prices (not followed by "off")
  const priceRe = /\$\s*([\d,]+(?:\.\d{1,2})?)/g;
  const prices: number[] = [];
  let m: RegExpExecArray | null;
  priceRe.lastIndex = 0;
  while ((m = priceRe.exec(withoutOff)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0.99 && val < 50_000) prices.push(val);
  }

  if (prices.length === 0) return { current: 0, original: undefined };
  if (prices.length === 1) return { current: prices[0], original: undefined };

  // Use "was/reg/orig/original" patterns to identify original price
  const wasRe = /(?:was|orig(?:inal)?|reg(?:ular)?|retail|msrp|list)\s*:?\s*\$\s*([\d,]+(?:\.\d{1,2})?)/gi;
  wasRe.lastIndex = 0;
  const wasPrices: number[] = [];
  while ((m = wasRe.exec(text)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(v)) wasPrices.push(v);
  }

  if (wasPrices.length > 0) {
    const original = wasPrices[0];
    const current = prices.find(p => p < original) ?? prices[0];
    return { current, original };
  }

  // Fallback: lowest = current, highest = original
  const sorted = [...prices].sort((a, b) => a - b);
  return { current: sorted[0], original: sorted[sorted.length - 1] };
}

// ─── Merchant URL extraction from Reddit Atom content ────────────────────────

const MERCHANT_HOSTS = new Set([
  'amazon.com', 'bestbuy.com', 'newegg.com', 'walmart.com', 'target.com',
  'bhphotovideo.com', 'adorama.com', 'apple.com', 'samsung.com', 'dell.com',
  'hp.com', 'lenovo.com', 'microsoft.com', 'woot.com', 'microcenter.com',
  'logitech.com', 'corsair.com', 'ebay.com', 'costco.com', 'rakuten.com',
  'store.steampowered.com', 'humble.com', 'gog.com',
]);

function isMerchant(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return MERCHANT_HOSTS.has(host) || MERCHANT_HOSTS.has(host.replace(/^[^.]+\./, ''));
  } catch { return false; }
}

function extractMerchantUrl(html: string): string | null {
  const linkRe = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const url = m[1];
    if (isMerchant(url)) return url;
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ageHours(pubDate: string): number {
  if (!pubDate) return 999;
  const d = new Date(pubDate);
  return isNaN(d.getTime()) ? 999 : (Date.now() - d.getTime()) / 3_600_000;
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now()}_${++seq}`;

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseRssItem(item: RssItem): RawDeal | null {
  const isReddit = item.link.includes('reddit.com');
  const rawTitle = item.title.trim();
  const age = ageHours(item.pubDate);

  // Deal URL resolution
  let deal_url = item.link;
  let is_external_link = false;

  if (isReddit) {
    const merchant = extractMerchantUrl(item.description);
    if (merchant) {
      deal_url = merchant;
      is_external_link = true;
    }
    // If no merchant URL found, deal_url stays as Reddit thread
    // → will fail QG013, correctly filtered out
  } else {
    // Slickdeals / 9to5Toys: use the article/deal page link
    is_external_link = true;
  }

  // Source domain
  let source: string;
  try {
    source = new URL(deal_url).hostname.toLowerCase().replace(/^www\./, '');
  } catch { return null; }

  // Clean title (strip Reddit flair + HTML entities)
  const cleanTitle = rawTitle
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#8217;/g, "'").replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/g, ' ').trim();
  if (cleanTitle.length < 8) return null;

  // Category (must not be "Other" to pass gate)
  const category = classifyCategory(rawTitle);

  // Prices
  const { current: price_current, original: price_original } = extractPrices(rawTitle);

  // Brand & model
  const brand = extractBrand(cleanTitle);
  const model = cleanTitle.replace(new RegExp(brand, 'i'), '').trim().split(/\s+/).slice(0, 5).join(' ');

  // Confidence
  let confidence = 0.55;
  if (price_current > 0)                                   confidence += 0.15;
  if (is_external_link && !source.includes('reddit.com')) confidence += 0.10;
  if (category !== 'Other')                                confidence += 0.10;
  if (brand !== 'Unknown')                                 confidence += 0.05;
  confidence = Math.min(0.95, confidence);

  return {
    id: nextId(isReddit ? 'rd' : 'sd'),
    title: cleanTitle,
    raw_title: rawTitle,
    source,
    deal_url,
    price_current: price_current > 0 ? price_current : undefined,
    price_original,
    category,
    brand,
    model,
    confidence_score: confidence,
    source_tier: item.sourceTier,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
    age_hours: age,
    is_external_link,
    has_price: price_current > 0,
    domain_matches_whitelist: isMerchant(deal_url),
  };
}

export function parseRssItems(items: RssItem[]): RawDeal[] {
  const deals: RawDeal[] = [];
  for (const item of items) {
    try {
      const d = parseRssItem(item);
      if (d) deals.push(d);
    } catch { /* skip */ }
  }
  return deals;
}
