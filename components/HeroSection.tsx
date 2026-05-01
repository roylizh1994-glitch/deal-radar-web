import type { DealItem } from '@/lib/types';

const BRAND_TIER_COLORS = {
  S: 'bg-orange-100 text-orange-700 border-orange-200',
  A: 'bg-blue-100 text-blue-700 border-blue-200',
  B: 'bg-gray-100 text-gray-600 border-gray-200',
};

function getCompareUrl(dealUrl: string): string | null {
  const m = dealUrl.match(/\/dp\/([A-Z0-9]{10})/i);
  return m ? `https://camelcamelcamel.com/product/${m[1]}` : null;
}

function HeroCard({ deal, featured }: { deal: DealItem; featured?: boolean }) {
  const savings = deal.price_original - deal.price_current;
  const hasSavings = savings > 0.005;
  const hasDiscount = deal.discount_pct > 0;
  const compareUrl = getCompareUrl(deal.deal_url);
  const brandBadgeClass = BRAND_TIER_COLORS[deal.brand_tier ?? 'B'];

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-5 hover:border-orange-300 hover:shadow-md transition-all duration-200 flex flex-col gap-3 ${featured ? 'ring-2 ring-orange-200' : ''}`}>

      {/* Top: brand badge + discount badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {deal.brand_tier && deal.brand_tier !== 'B' && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${brandBadgeClass}`}>
              {deal.brand_tier === 'S' ? '主流品牌' : '品牌'}
            </span>
          )}
          <span className="text-xs font-medium text-gray-500">{deal.brand}</span>
          {featured && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white uppercase tracking-wide">
              今日最优
            </span>
          )}
        </div>
        {hasDiscount ? (
          <div className="flex-shrink-0 bg-orange-500 text-white text-sm font-bold rounded-xl px-2.5 py-1.5 leading-none">
            -{deal.discount_pct}%
          </div>
        ) : (
          <div className="flex-shrink-0 bg-gray-100 text-gray-400 text-xs rounded-xl px-2.5 py-1.5 leading-tight font-medium">
            关注价
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className={`font-semibold text-gray-900 leading-snug line-clamp-2 ${featured ? 'text-base' : 'text-sm'}`}>
        {deal.title}
      </h3>

      {/* Price */}
      <div className="flex items-baseline gap-2">
        <span className={`font-bold text-gray-900 ${featured ? 'text-2xl' : 'text-xl'}`}>
          ${deal.price_current.toFixed(2)}
        </span>
        {deal.price_original > deal.price_current && (
          <span className="text-sm text-gray-400 line-through">
            ${deal.price_original.toFixed(2)}
          </span>
        )}
        {hasSavings && (
          <span className="text-sm font-semibold text-green-600">
            省${savings.toFixed(0)}
          </span>
        )}
      </div>

      {/* Meta: source */}
      <p className="text-xs text-gray-400">
        {deal.source.replace(/^www\./, '')}
        {deal.verified_at && (
          <> · {new Date(deal.verified_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 验证</>
        )}
      </p>

      {/* CTAs */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <a
          href={deal.deal_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          去购买
        </a>
        {compareUrl ? (
          <a
            href={compareUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="查看历史价格走势"
            className="text-sm text-gray-500 hover:text-orange-600 px-3 py-2 rounded-xl border border-gray-200 hover:border-orange-300 transition-colors whitespace-nowrap"
          >
            看比价
          </a>
        ) : (
          <span className="text-xs text-gray-300 px-3 py-2 rounded-xl border border-gray-100 cursor-not-allowed select-none whitespace-nowrap">
            比价数据不足
          </span>
        )}
      </div>
    </div>
  );
}

interface Props {
  items: DealItem[];
}

export default function HeroSection({ items }: Props) {
  if (items.length === 0) return null;

  const [top, ...rest] = items.slice(0, 3);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">今日品牌好价精选</h2>
        <span className="text-xs text-gray-400">每日自动更新</span>
      </div>

      {/* Large featured card + 2 secondary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <HeroCard deal={top} featured />
        </div>
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rest.map(deal => (
            <HeroCard key={deal.id} deal={deal} />
          ))}
          {rest.length < 2 && <div />}
        </div>
      </div>
    </section>
  );
}
