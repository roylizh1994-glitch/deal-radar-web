import type { DealItem } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  TV: 'bg-purple-100 text-purple-700',
  Audio: 'bg-blue-100 text-blue-700',
  Monitor: 'bg-cyan-100 text-cyan-700',
  Laptop: 'bg-indigo-100 text-indigo-700',
  Storage: 'bg-green-100 text-green-700',
  Peripheral: 'bg-yellow-100 text-yellow-700',
  Accessory: 'bg-pink-100 text-pink-700',
  Other: 'bg-gray-100 text-gray-600',
};

function SourceLogo({ source }: { source: string }) {
  const clean = source.replace(/^www\./, '');
  return (
    <span className="text-xs text-gray-400 font-medium truncate max-w-[120px]">
      {clean}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 85 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-orange-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400">{pct}</span>
    </div>
  );
}

interface DealCardProps {
  deal: DealItem;
}

export default function DealCard({ deal }: DealCardProps) {
  const catColor = CATEGORY_COLORS[deal.category] ?? CATEGORY_COLORS.Other;
  const savings = deal.price_original - deal.price_current;

  return (
    <a
      href={deal.deal_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-orange-300 hover:shadow-md transition-all duration-200"
    >
      {/* Rank */}
      <div className="flex-shrink-0 w-8 text-center">
        <span className={`text-sm font-bold ${deal.rank <= 3 ? 'text-orange-500' : 'text-gray-300'}`}>
          #{deal.rank}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catColor}`}>
                {deal.category}
              </span>
              <SourceLogo source={deal.source} />
            </div>
            <h3 className="text-sm font-medium text-gray-800 leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors">
              {deal.title}
            </h3>
          </div>

          {/* Discount badge */}
          <div className="flex-shrink-0 bg-orange-500 text-white text-sm font-bold rounded-lg px-2.5 py-1.5 leading-none">
            -{deal.discount_pct}%
          </div>
        </div>

        {/* Pricing row */}
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-lg font-bold text-gray-900">
            ${deal.price_current.toFixed(2)}
          </span>
          <span className="text-sm text-gray-400 line-through">
            ${deal.price_original.toFixed(2)}
          </span>
          <span className="text-xs text-green-600 font-medium">
            省 ${savings.toFixed(2)}
          </span>
        </div>

        {/* Score bar */}
        <div className="mt-2">
          <ScoreBar score={deal.score} />
        </div>
      </div>

      {/* Arrow */}
      <div className="flex-shrink-0 self-center text-gray-300 group-hover:text-orange-400 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </a>
  );
}
