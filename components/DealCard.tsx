import type { DealItem } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  GPU:        'bg-red-100 text-red-700',
  CPU:        'bg-orange-100 text-orange-700',
  RAM:        'bg-yellow-100 text-yellow-700',
  Storage:    'bg-green-100 text-green-700',
  'PC Parts': 'bg-slate-100 text-slate-600',
  Laptop:     'bg-indigo-100 text-indigo-700',
  Phone:      'bg-blue-100 text-blue-700',
  Tablet:     'bg-cyan-100 text-cyan-700',
  TV:         'bg-purple-100 text-purple-700',
  Monitor:    'bg-violet-100 text-violet-700',
  Audio:      'bg-pink-100 text-pink-700',
  Peripheral: 'bg-amber-100 text-amber-700',
  Networking: 'bg-teal-100 text-teal-700',
  Wearable:   'bg-rose-100 text-rose-700',
  Camera:     'bg-lime-100 text-lime-700',
  Accessory:  'bg-gray-100 text-gray-600',
  Gaming:     'bg-fuchsia-100 text-fuchsia-700',
  Software:   'bg-sky-100 text-sky-700',
  Other:      'bg-gray-100 text-gray-500',
};

function getCompareUrl(dealUrl: string): string | null {
  const asinMatch = dealUrl.match(/\/dp\/([A-Z0-9]{10})/i);
  if (asinMatch) return `https://camelcamelcamel.com/product/${asinMatch[1]}`;
  return null;
}

function formatVerifiedTime(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function DealCard({ deal, displayRank, isWatching }: { deal: DealItem; displayRank?: number; isWatching?: boolean }) {
  const rank = displayRank ?? deal.rank;
  const catColor = CATEGORY_COLORS[deal.category] ?? CATEGORY_COLORS.Other;
  const hasDiscount = deal.discount_pct > 0;
  const savings = deal.price_original - deal.price_current;
  const hasSavings = savings > 0.005;
  const displayDomain = deal.source.replace(/^www\./, '');
  const compareUrl = getCompareUrl(deal.deal_url);
  const verifiedTime = formatVerifiedTime(deal.verified_at);
  const scorePct = Math.round(deal.score * 100);
  const scoreColor = scorePct >= 80 ? 'bg-green-500' : scorePct >= 65 ? 'bg-yellow-400' : 'bg-orange-400';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-orange-200 hover:shadow-sm transition-all duration-200">
      <div className="flex items-start gap-3">

        {/* Rank */}
        <div className="flex-shrink-0 w-7 pt-0.5 text-center">
          {isWatching ? (
            <span className="text-sm text-gray-200">·</span>
          ) : (
            <span className={`text-sm font-bold ${rank <= 3 ? 'text-orange-500' : 'text-gray-300'}`}>
              #{rank}
            </span>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">

          {/* Meta row: category + source + verified time */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catColor}`}>
              {deal.category}
            </span>
            <span className="text-xs text-gray-400">{displayDomain}</span>
            {verifiedTime && (
              <span className="text-xs text-gray-300">· 验证 {verifiedTime}</span>
            )}
          </div>

          {/* Title — max 2 lines */}
          <h3 className="text-sm font-medium text-gray-800 leading-snug line-clamp-2 mb-2.5">
            {deal.title}
          </h3>

          {/* Price block */}
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-xl font-bold text-gray-900">
              ${deal.price_current.toFixed(2)}
            </span>
            {deal.price_original > deal.price_current && (
              <span className="text-sm text-gray-400 line-through">
                ${deal.price_original.toFixed(2)}
              </span>
            )}
            {hasSavings && (
              <span className="text-sm font-semibold text-green-600">
                省 ${savings.toFixed(2)}
              </span>
            )}
          </div>

          {/* CTA row */}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={deal.deal_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              去购买
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </a>

            {compareUrl ? (
              <a
                href={compareUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="查看历史价格走势（CamelCamelCamel）"
                className="inline-flex items-center text-xs text-gray-500 hover:text-orange-600 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors"
              >
                看比价
              </a>
            ) : (
              <span className="text-xs text-gray-200 px-2.5 py-1.5 rounded-lg border border-gray-100 cursor-not-allowed select-none">
                比价数据不足
              </span>
            )}

            {/* Score — tooltip explains the formula */}
            <div
              className="ml-auto flex items-center gap-1.5"
              title={`综合分 ${scorePct} = 折扣力度 × 可信度 × 数据新鲜度`}
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${scoreColor}`} style={{ width: `${scorePct}%` }} />
              </div>
              <span className="text-xs text-gray-400">{scorePct}</span>
            </div>
          </div>

        </div>

        {/* Discount badge / 价格持平 */}
        <div className="flex-shrink-0 pt-0.5 text-center min-w-[52px]">
          {hasDiscount ? (
            <div className="bg-orange-500 text-white text-sm font-bold rounded-lg px-2 py-1.5 leading-none">
              -{deal.discount_pct}%
            </div>
          ) : (
            <div className="bg-gray-100 text-gray-400 text-xs font-medium rounded-lg px-2 py-1.5 leading-tight">
              价格<br/>持平
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
