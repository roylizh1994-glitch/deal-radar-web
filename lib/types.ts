export interface DealItem {
  rank: number;
  id: string;
  title: string;
  brand: string;
  model: string;
  category: string;
  source: string;
  price_current: number;
  price_original: number;
  discount_pct: number;
  score: number;
  confidence_score: number;
  deal_url: string;
  verified_at?: string;  // ISO timestamp when pipeline last ran
}

export type PublishMode = 'FULL_PUBLISH' | 'PARTIAL_PUBLISH' | 'HARD_FAIL';

export interface HomepageData {
  generated_at: string;
  date: string;
  mode: PublishMode;
  banner: string | null;
  /** Global top-10 across all categories (default view) */
  items: DealItem[];
  /** Per-category top-10: { "GPU": [...], "Laptop": [...], ... } */
  categories?: Record<string, DealItem[]>;
  /** How many items each category has today */
  category_counts?: Record<string, number>;
}
