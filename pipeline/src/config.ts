/**
 * DealRadar Config Loader
 * Reads .env file and environment variables.
 * Masks sensitive credentials in logs (shows last 4 chars only).
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface AppConfig {
  // Reddit OAuth
  reddit: {
    client_id: string;
    client_secret: string;
    user_agent: string;
    username?: string;
    password?: string;
  };
  // ScraperAPI proxy
  scraper_api: {
    key: string;
    endpoint: string;
  };
  // Feature flags
  features: {
    enable_reddit_source: boolean;
    reddit_discovery_only: boolean;
    enable_tier1_scraper_source: boolean;
    enable_purchasable_score: boolean;
    enable_source_health: boolean;
    enable_partial_publish: boolean;
  };
  // Safety
  safety: {
    max_broken_link_ratio: number;
    min_publishable_items: number;
    topk_publish: number;
    freshness_half_life_hours: number;
  };
  // Rate limits
  rate_limits: {
    reddit_max_req_per_min: number;
    reddit_consecutive_fail_cooldown_sec: number;
    source_max_retry: number;
    source_retry_backoff_ms: number;
  };
}

function mask(key: string): string {
  if (!key || key.length <= 4) return '****';
  return '...' + key.slice(-4);
}

function readEnvFile(envPath: string): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!existsSync(envPath)) return vars;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

let _config: AppConfig | null = null;

/**
 * Load and return config. Reads .env if present.
 * Sensitive values are masked in any logged output.
 */
export function loadConfig(): AppConfig {
  if (_config) return _config;

  const envFile = resolve(process.cwd(), '.env');
  const fileVars = readEnvFile(envFile);
  const merged = { ...fileVars, ...process.env };

  const redditSecret = merged['REDDIT_CLIENT_SECRET'] || merged['reddit_client_secret'] || '';
  const scraperKey = merged['SCRAPERAPI_KEY'] || merged['scraperapi_key'] || '';

  _config = {
    reddit: {
      client_id: merged['REDDIT_CLIENT_ID'] || merged['reddit_client_id'] || '',
      client_secret: redditSecret,
      user_agent: merged['REDDIT_USER_AGENT'] || 'DealRadarBot/1.0',
      username: merged['REDDIT_USERNAME'] || undefined,
      password: merged['REDDIT_PASSWORD'] || undefined,
    },
    scraper_api: {
      key: scraperKey,
      endpoint: merged['SCRAPERAPI_ENDPOINT'] || 'https://api.scraperapi.com',
    },
    features: {
      enable_reddit_source: merged['ENABLE_REDDIT_SOURCE'] !== 'false',
      reddit_discovery_only: merged['REDDIT_DISCOVERY_ONLY'] !== 'false',
      enable_tier1_scraper_source: merged['ENABLE_TIER1_SCRAPER_SOURCE'] === 'true',
      enable_purchasable_score: merged['ENABLE_PURCHASABLE_SCORE'] !== 'false',
      enable_source_health: merged['ENABLE_SOURCE_HEALTH'] !== 'false',
      enable_partial_publish: merged['ENABLE_PARTIAL_PUBLISH'] !== 'false',
    },
    safety: {
      max_broken_link_ratio: parseFloat(merged['MAX_BROKEN_LINK_RATIO'] || '0.20'),
      min_publishable_items: parseInt(merged['MIN_PUBLISHABLE_ITEMS'] || '5', 10),
      topk_publish: parseInt(merged['TOPK_PUBLISH'] || '10', 10),
      freshness_half_life_hours: parseInt(merged['FRESHNESS_HALF_LIFE_HOURS'] || '12', 10),
    },
    rate_limits: {
      reddit_max_req_per_min: parseInt(merged['REDDIT_MAX_REQ_PER_MIN'] || '8', 10),
      reddit_consecutive_fail_cooldown_sec: parseInt(merged['REDDIT_CONSECUTIVE_FAIL_COOLDOWN'] || '60', 10),
      source_max_retry: parseInt(merged['SOURCE_MAX_RETRY'] || '2', 10),
      source_retry_backoff_ms: parseInt(merged['SOURCE_RETRY_BACKOFF_MS'] || '1000', 10),
    },
  };

  return _config;
}

/**
 * Log config status (credentials masked)
 */
export function logConfigStatus(): void {
  const cfg = loadConfig();
  console.log('\n=== CONFIG STATUS ===');
  console.log(`Reddit Client ID: ${cfg.reddit.client_id ? mask(cfg.reddit.client_id) : '❌ NOT SET'}`);
  console.log(`Reddit Client Secret: ${cfg.reddit.client_secret ? mask(cfg.reddit.client_secret) : '❌ NOT SET'}`);
  console.log(`Reddit User-Agent: ${cfg.reddit.user_agent}`);
  console.log(`ScraperAPI Key: ${cfg.scraper_api.key ? mask(cfg.scraper_api.key) : '❌ NOT SET'}`);
  console.log(`ScraperAPI Endpoint: ${cfg.scraper_api.endpoint}`);
  console.log('\nFeature Flags:');
  console.log(`  enable_reddit_source: ${cfg.features.enable_reddit_source}`);
  console.log(`  reddit_discovery_only: ${cfg.features.reddit_discovery_only}`);
  console.log(`  enable_tier1_scraper_source: ${cfg.features.enable_tier1_scraper_source}`);
  console.log(`  enable_purchasable_score: ${cfg.features.enable_purchasable_score}`);
  console.log(`  enable_source_health: ${cfg.features.enable_source_health}`);
  console.log(`  enable_partial_publish: ${cfg.features.enable_partial_publish}`);
  console.log('\nSafety:');
  console.log(`  max_broken_link_ratio: ${cfg.safety.max_broken_link_ratio}`);
  console.log(`  min_publishable_items: ${cfg.safety.min_publishable_items}`);
  console.log(`  topk_publish: ${cfg.safety.topk_publish}`);
  console.log(`  freshness_half_life_hours: ${cfg.safety.freshness_half_life_hours}h`);
  console.log('====================\n');
}
