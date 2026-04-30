'use client';

import { useState } from 'react';
import DealCard from './DealCard';
import type { DealItem } from '@/lib/types';

// Parent group → child categories
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

// Map each child category back to its parent group
const CAT_TO_GROUP: Record<string, string> = {};
for (const [group, cats] of Object.entries(CATEGORY_GROUPS)) {
  for (const cat of cats) CAT_TO_GROUP[cat] = group;
}

const GROUP_ORDER = Object.keys(CATEGORY_GROUPS);

interface Props {
  items: DealItem[];
}

export default function DealListClient({ items }: Props) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedCat,   setSelectedCat]   = useState<string | null>(null);

  // Which parent groups actually have items?
  const activeGroups = GROUP_ORDER.filter(g =>
    items.some(d => CAT_TO_GROUP[d.category] === g)
  );

  // Sub-categories in the selected group that actually have items
  const subCats = selectedGroup
    ? (CATEGORY_GROUPS[selectedGroup] ?? []).filter(c =>
        items.some(d => d.category === c)
      )
    : [];

  // Filtered items
  const filtered = items.filter(d => {
    if (selectedCat)   return d.category === selectedCat;
    if (selectedGroup) return CAT_TO_GROUP[d.category] === selectedGroup;
    return true;
  });

  function pickGroup(g: string | null) {
    setSelectedGroup(g);
    setSelectedCat(null);
  }

  const chipBase = 'text-xs font-medium px-3 py-1.5 rounded-full border transition-all cursor-pointer';
  const chipIdle  = `${chipBase} bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600`;
  const chipActive = `${chipBase} bg-orange-500 border-orange-500 text-white shadow-sm`;

  return (
    <div>
      {/* ── Group filter row ── */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => pickGroup(null)}
          className={selectedGroup === null ? chipActive : chipIdle}
        >
          全部 · {items.length}
        </button>
        {activeGroups.map(g => {
          const count = items.filter(d => CAT_TO_GROUP[d.category] === g).length;
          return (
            <button
              key={g}
              onClick={() => pickGroup(g)}
              className={selectedGroup === g ? chipActive : chipIdle}
            >
              {g} · {count}
            </button>
          );
        })}
      </div>

      {/* ── Sub-category chips (only when a group is selected) ── */}
      {subCats.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4 pl-1">
          <button
            onClick={() => setSelectedCat(null)}
            className={selectedCat === null
              ? 'text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-medium border border-orange-200 cursor-pointer'
              : 'text-xs px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100 cursor-pointer'
            }
          >
            全部
          </button>
          {subCats.map(cat => {
            const count = items.filter(d => d.category === cat).length;
            const isActive = selectedCat === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={isActive
                  ? 'text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-medium border border-orange-200 cursor-pointer'
                  : 'text-xs px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100 cursor-pointer'
                }
              >
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
          <p className="text-sm">该分类今日暂无折扣</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(deal => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
