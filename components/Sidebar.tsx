import type { HomepageData } from '@/lib/types';

const MERCHANT_LABELS: Record<string, { name: string; color: string }> = {
  'amazon.com':       { name: 'Amazon',   color: 'bg-yellow-400' },
  'bestbuy.com':      { name: 'Best Buy', color: 'bg-blue-600' },
  'walmart.com':      { name: 'Walmart',  color: 'bg-blue-500' },
  'target.com':       { name: 'Target',   color: 'bg-red-600' },
  'newegg.com':       { name: 'Newegg',   color: 'bg-orange-600' },
  'bhphotovideo.com': { name: 'B&H Photo', color: 'bg-gray-700' },
  'adorama.com':      { name: 'Adorama',  color: 'bg-green-600' },
  'microcenter.com':  { name: 'Micro Center', color: 'bg-red-700' },
  'woot.com':         { name: 'Woot',     color: 'bg-purple-600' },
  'apple.com':        { name: 'Apple',    color: 'bg-gray-800' },
  'dell.com':         { name: 'Dell',     color: 'bg-blue-700' },
};

const CATEGORY_ICONS: Record<string, string> = {
  GPU: '🎮', CPU: '⚡', Laptop: '💻', Phone: '📱', Monitor: '🖥️',
  Tablet: '📲', Audio: '🎧', Camera: '📷', RAM: '🧩', Storage: '💾',
  'PC Parts': '🔩', Peripheral: '🖱️', TV: '📺', Wearable: '⌚',
  Networking: '📡', Gaming: '🕹️',
};

interface Props {
  data: HomepageData;
}

export default function Sidebar({ data }: Props) {
  const { top_brands = [], top_merchants = [], category_counts = {} } = data;

  const topCats = Object.entries(category_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <aside className="flex flex-col gap-5">

      {/* ── Today's top merchants ── */}
      {top_merchants.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">热门商家</h3>
          <div className="flex flex-col gap-1.5">
            {top_merchants.map(m => {
              const meta = MERCHANT_LABELS[m] ?? { name: m.replace('.com', ''), color: 'bg-gray-400' };
              return (
                <div key={m} className="flex items-center gap-2.5 py-1 group cursor-default">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.color}`} />
                  <span className="text-sm text-gray-700 group-hover:text-orange-600 transition-colors">
                    {meta.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Top brands today ── */}
      {top_brands.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">今日热门品牌</h3>
          <div className="flex flex-wrap gap-1.5">
            {top_brands.map(brand => (
              <span
                key={brand}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 cursor-pointer transition-colors"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Top categories ── */}
      {topCats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">热门分类</h3>
          <div className="flex flex-col gap-1">
            {topCats.map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between py-1 group cursor-default">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{CATEGORY_ICONS[cat] ?? '📦'}</span>
                  <span className="text-sm text-gray-700 group-hover:text-orange-600 transition-colors">{cat}</span>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Alert CTA (Week 3 stub) ── */}
      <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
        <h3 className="text-sm font-semibold text-orange-800 mb-1">降价提醒</h3>
        <p className="text-xs text-orange-700 mb-3 leading-relaxed">
          关注心仪品牌，价格一降立刻通知你
        </p>
        <button
          disabled
          className="w-full text-xs font-medium bg-orange-500 text-white py-2 rounded-lg opacity-60 cursor-not-allowed"
          title="即将上线"
        >
          即将上线 · 敬请期待
        </button>
      </div>

      {/* ── Data note ── */}
      <p className="text-[11px] text-gray-400 leading-relaxed px-1">
        价格实时变动，以商家页面为准。DealRadar 不参与任何交易，不含推广。
      </p>

    </aside>
  );
}
