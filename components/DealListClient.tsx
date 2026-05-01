'use client';

import { useState, useMemo } from 'react';
import DealCard from './DealCard';
import type { DealItem } from '@/lib/types';

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

const GROUP_ORDER = Object.keys(CATEGORY_GROUPS);

// ── Sort ──────────────────────────────────────────────────────────────────────

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
    case 'discount': return copy.sort((a, b) => b.discount_pct - a.discount_pct);
    case 'savings':  return copy.sort((a, b) =>
      (b.price_original - b.price_current) - (a.price_original - a.price_current));
    case 'newest':   return copy.sort((a, b) =>
      (b.verified_at ?? '').localeCompare(a.verified_at ?? ''));
    default:         return copy.sort((a, b) => b.score - a.score);
  }
}

// ── View mode ─────────────────────────────────────────────────────────────────

type ViewMode = 'deals'     // 好价榜: discount_pct > 0
              | 'watching'; // 关注价: discount_pct === 0

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  items: DealItem[];
  categories?: Record<string, DealItem[]>;
}

const MAX_CAT_VIEW = 10;

export default function DealListClient({ items, categories = {} }: Props) {
  const [viewMode,      setViewMode]      = useState<ViewMode>('deals');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedCat,   setSelectedCat]   = useState<string | null>(null);
  const [sortKey,       setSortKey]       = useState<SortKey>('score');

  // ── Unified item pool ──────────────────────────────────────────────────────
  // All category buckets flattened.  Falls back to global items if no buckets.
  const poolItems = useMemo(() => {
    const flat = Object.values(categories).flat();
    return flat.length > 0 ? flat : items;
  }, [categories, items]);

  // ── Mode predicates (stable references to avoid useMemo dep issues) ────────
  const isReal  = (d: DealItem) => d.discount_pct > 0;
  const isWatch = (d: DealItem) => d.discount_pct === 0;

  // ── Helpers: pool for a category/group ────────────────────────────────────
  function catPool(cat: string): DealItem[] {
    return categories[cat] ?? poolItems.filter(d => d.category === cat);
  }
  function groupPool(group: string): DealItem[] {
    return (CATEGORY_GROUPS[group] ?? []).flatMap(cat => catPool(cat));
  }

  // ── Filtered list — the ONE source of truth ────────────────────────────────
  // count badges and rendered list both derive from this.
  const filtered = useMemo(() => {
    const inMode = viewMode === 'deals' ? isReal : isWatch;

    if (selectedCat) {
      return sortItems(catPool(selectedCat).filter(inMode), sortKey)
        .slice(0, MAX_CAT_VIEW);
    }
    if (selectedGroup) {
      return sortItems(groupPool(selectedGroup).filter(inMode), sortKey);
    }
    // "全部" uses poolItems (all buckets), same array as tab-level counts
    return sortItems(poolItems.filter(inMode), sortKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolItems, categories, viewMode, selectedGroup, selectedCat, sortKey]);

  // ── Count helpers — mirror filtered exactly (no slicing for nav) ──────────
  // All three: tab totals, group chips, sub-cat chips derive from poolItems too.
  const totalDeals    = poolItems.filter(isReal).length;
  const totalWatching = poolItems.filter(isWatch).length;

  function countGlobal(): number {
    // Must equal filtered.length when no group/cat is selected
    const inMode = viewMode === 'deals' ? isReal : isWatch;
    return poolItems.filter(inMode).length;
  }
  function countGroup(group: string): number {
    const inMode = viewMode === 'deals' ? isReal : isWatch;
    return groupPool(group).filter(inMode).length;
  }
  function countCat(cat: string): number {
    const inMode = viewMode === 'deals' ? isReal : isWatch;
    return catPool(cat).filter(inMode).length;
  }

  // ── Active groups/sub-cats (only those with > 0 items in current mode) ──
  const activeGroups = GROUP_ORDER.filter(g => countGroup(g) > 0);
  const subCats = selectedGroup
    ? (CATEGORY_GROUPS[selectedGroup] ?? []).filter(c => countCat(c) > 0)
    : [];

  // ── Nav helpers ──
  function pickGroup(g: string | null) { setSelectedGroup(g); setSelectedCat(null); }
  function switchMode(m: ViewMode)     { setViewMode(m); pickGroup(null); }

  // ── Chip styles ──
  const chipBase   = 'text-xs font-medium px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none';
  const chipIdle   = `${chipBase} bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600`;
  const chipActive = `${chipBase} bg-orange-500 border-orange-500 text-white shadow-sm`;
  const subBase    = 'text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors select-none';
  const subIdle    = `${subBase} bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100`;
  const subActive  = `${subBase} bg-orange-100 text-orange-700 font-medium border-orange-200`;

  // ── Empty-state text ──
  const emptyText = selectedCat ?? selectedGroup
    ? viewMode === 'deals' ? '该品类今日暂无真实折扣' : '该品类今日暂无关注价商品'
    : viewMode === 'deals' ? '今日暂无真实折扣' : '今日暂无关注价商品';

  return (
    <div>

      {/* ── Mode tabs ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-100 pb-3">
        <button
          onClick={() => switchMode('deals')}
          className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            viewMode === 'deals'
              ? 'bg-orange-50 text-orange-600 border border-orange-200'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          好价榜
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal ${
            viewMode === 'deals' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
          }`}>
            {totalDeals}
          </span>
        </button>

        <button
          onClick={() => switchMode('watching')}
          className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            viewMode === 'watching'
              ? 'bg-gray-100 text-gray-700 border border-gray-200'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          关注价
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal ${
            viewMode === 'watching' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
          }`}>
            {totalWatching}
          </span>
        </button>

        {viewMode === 'watching' && (
          <span className="ml-3 text-xs text-gray-400 hidden sm:inline">
            价格持平或接近低位，建议关注
          </span>
        )}
      </div>

      {/* ── Sort bar ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
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
      </div>

      {/* ── Group chips ── */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => pickGroup(null)}
          className={selectedGroup === null ? chipActive : chipIdle}
        >
          全部 · {countGlobal()}
        </button>
        {activeGroups.map(g => (
          <button
            key={g}
            onClick={() => pickGroup(g)}
            className={selectedGroup === g ? chipActive : chipIdle}
          >
            {g} · {countGroup(g)}
          </button>
        ))}
      </div>

      {/* ── Sub-cat chips ── */}
      {subCats.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4 pl-1">
          <button
            onClick={() => setSelectedCat(null)}
            className={selectedCat === null ? subActive : subIdle}
          >
            全部
          </button>
          {subCats.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={selectedCat === cat ? subActive : subIdle}
            >
              {cat} · {countCat(cat)}
            </button>
          ))}
        </div>
      )}

      {/* ── Deal list ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2">{viewMode === 'deals' ? '📭' : '👀'}</p>
          <p className="text-sm">{emptyText}</p>
          {viewMode === 'deals' && totalWatching > 0 && (
            <button
              onClick={() => switchMode('watching')}
              className="mt-3 text-xs text-gray-400 hover:text-orange-500 cursor-pointer transition-colors"
            >
              查看关注价 ({totalWatching} 条) →
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((deal, idx) => (
            <DealCard
              key={deal.id}
              deal={deal}
              displayRank={idx + 1}
              isWatching={viewMode === 'watching'}
            />
          ))}
        </div>
      )}

    </div>
  );
}
