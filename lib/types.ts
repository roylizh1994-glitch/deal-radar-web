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
}

export type PublishMode = 'FULL_PUBLISH' | 'PARTIAL_PUBLISH' | 'HARD_FAIL';

export interface HomepageData {
  generated_at: string;
  date: string;
  mode: PublishMode;
  banner: string | null;
  items: DealItem[];
}
