'use client';

import { useState, useMemo } from 'react';
import DealCard from './DealCard';
import type { DealItem, HomepageData } from '@/lib/types';

// ── Category hierarchy ────────────────────────────────────────────────────────

const CATEGORY_GROUPS: Record<string, string[]> = {
  'PC 配件':   ['GPU', 'CPU', 'RAM', 'Storage', 'PC Parts'],
  '笔电/手机': ['Laptop', 'Phone', 'Tablet'],
  '屏幕/TV':   ['Monitor', 'TV', 'Projector'],
  '外设':      ['Peripheral', 'Accessory', 'Networking'],
  '音频':      ['Audio'],
  '穿戴/拍摄': ['Wearable', 'Camera'],
  '游戏/软件': ['Gaming', 'Software'],
  '其他':      ['Other'],
};

const CAT_TO_GROUP: Record<string, string> = {};
for (const [group, cats] of Object.entries(CATEGORY_GROUPS)) {
  for (const cat of cats) CAT_TO_GROUP[cat] = group;
}

const GROUP_ORDER = Object.keys(CATEGORY_GROUPS);

// ── Sort options ──────────────────────────────────────────────────────────────

type SortKey = 'score' | 'discount' | 'savings' | 'newest';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'score',    label: '综合最高' },
  { key: 'discount', label: '折扣最高' },
  { key: 'savings',  label: '省钱最多' },
  { key: 'newest',   label: '最新发布' },
];

function sortItems(items: DealItem[], sort: SortKey): DealItem[] {
  const copy = [...items];
  switch (sort) {
    case 'discount':
      return copy.sort((a, b) => b.discount_pct - a.discount_pct);
    case 'savings':
      return copy.sort((a, b) =>
        (b.price_original - b.price_current) - (a.price_original - a.price_current)
      );
    case 'newest':
      return copy.sort((a, b) =>
        (b.verified_at ?? '').localeCompare(a.verified_at ?? '')
      );
    default: // score
      return copy.sort((a, b) => b.score - a.score);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Global top-10 for the default "全部" view */
  items: DealItem[];
  /** Per-category pools (each already up to 10 items, sorted by score) */
  categories?: Record<string, DealItem[]>;
}

const MAX_CAT_VIEW = 10;

export default function DealListClient({ items, categories = {} }: Props) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedCat,   setSelectedCat]   = useState<string | null>(null);
  const [sortKey,       setSortKey]       = useState<SortKey>('score');
  const [realOnly,      setRealOnly]      = useState(false);

  // All items across all category pools (for counts / toggles)
  const allCatItems = useMemo(() =>
    Object.values(categories).flat(), [categories]
  );
  // Fall back to global top-10 if no per-category data
  const poolItems = allCatItems.length > 0 ? allCatItems : items;

  const realCount    = poolItems.filter(d => d.discount_pct > 0).length;
  const activeGroups = GROUP_ORDER.filter(g =>
    poolItems.some(d => CAT_TO_GROUP[d.category] === g)
  );
  const subCats = selectedGroup
    ? (CATEGORY_GROUPS[selectedGroup] ?? []).filter(c => poolItems.some(d => d.category === c))
    : [];

  const filtered = useMemo(() => {
    // If a specific fine-grained category is selected, use its pre-sorted pool (up to 10)
    if (selectedCat) {
      let catItems = categories[selectedCat] ?? poolItems.filter(d => d.category === selectedCat);
      if (realOnly) catItems = catItems.filter(d => d.discount_pct > 0);
      return sortItems(catItems, sortKey).slice(0, MAX_CAT_VIEW);
    }
    // If a parent group is selected, use all items from that group
    if (selectedGroup) {
      const cats = CATEGORY_GROUPS[selectedGroup] ?? [];
      let groupItems: DealItem[] = [];
      for (const cat of cats) {
        groupItems.push(...(categories[cat] ?? poolItems.filter(d => d.category === cat)));
      }
      if (realOnly) groupItems = groupItems.filter(d => d.discount_pct > 0);
      return sortItems(groupItems, sortKey);
    }
    // Default: global top-10 (pre-ranked by pipeline)
    let list = realOnly ? items.filter(d => d.discount_pct > 0) : items;
    return sortItems(list, sortKey);
  }, [items, categories, poolItems, realOnly, selectedGroup, selectedCat, sortKey]);

  function pickGroup(g: string | null) {
    setSelectedGroup(g);
    setSelectedCat(null);
  }

  // ── Shared chip style helpers ──
  const chipBase = 'text-xs font-medium px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none';
  const chipIdle   = `${chipBase} bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600`;
  const chipActive = `${chipBase} bg-orange-500 border-orange-500 text-white shadow-sm`;

  const subBase   = 'text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors select-none';
  const subIdle   = `${subBase} bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100`;
  const subActive = `${subBase} bg-orange-100 text-orange-700 font-medium border-orange-200`;

  return (
    <div>
      {/* ── Top toolbar: sort + real-deal toggle ── */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        {/* Sort tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              className={`text-xs px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                sortKey === opt.key
                  ? 'bg-white text-orange-600 font-semibold shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Real-discount toggle */}
        <button
          onClick={() => setRealOnly(!realOnly)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${
            realOnly
              ? 'bg-green-50 border-green-400 text-green-700'
              : 'bg-white border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
          }`}
        >
          <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
            realOnly ? 'bg-green-500 border-green-500' : 'border-gray-300'
          }`} />
          仅看真实降价
          {realOnly && <span className="text-green-600 font-semibold">{realCount}</span>}
        </button>
      </div>

      {/* ── Category group filter ── */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => pickGroup(null)} className={selectedGroup === null ? chipActive : chipIdle}>
          全部 · {realOnly ? realCount : items.length}
        </button>
        {activeGroups.map(g => {
          const cats = CATEGORY_GROUPS[g] ?? [];
          const count = cats.reduce((sum, cat) => {
            const catItems = categories[cat] ?? poolItems.filter(d => d.category === cat);
            return sum + (realOnly ? catItems.filter(d => d.discount_pct > 0) : catItems).length;
          }, 0);
          if (count === 0) return null;
          return (
            <button key={g} onClick={() => pickGroup(g)} className={selectedGroup === g ? chipActive : chipIdle}>
              {g} · {count}
            </button>
          );
        })}
      </div>

      {/* ── Sub-category chips ── */}
      {subCats.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4 pl-1">
          <button onClick={() => setSelectedCat(null)} className={selectedCat === null ? subActive : subIdle}>
            全部
          </button>
          {subCats.map(cat => {
            const count = items.filter(d => d.category === cat && (!realOnly || d.discount_pct > 0)).length;
            if (count === 0) return null;
            return (
              <button key={cat} onClick={() => setSelectedCat(cat)} className={selectedCat === cat ? subActive : subIdle}>
                {cat} · {count}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Deal list ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">
            {realOnly ? '该分类今日暂无真实降价折扣' : '该分类今日暂无折扣'}
          </p>
          {realOnly && (
            <button
              onClick={() => setRealOnly(false)}
              className="mt-3 text-xs text-orange-500 hover:underline cursor-pointer"
            >
              查看全部条目 →
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((deal, idx) => (
            <DealCard key={deal.id} deal={deal} displayRank={idx + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
