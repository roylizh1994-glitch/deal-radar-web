import Header from '@/components/Header';
import DealCard from '@/components/DealCard';
import type { HomepageData } from '@/lib/types';
import liveData from '@/data/homepage.json';
import mockData from '@/data/mock-homepage.json';

// Static page: data is baked in at build time.
// GitHub Actions pushes new homepage.json → Netlify rebuilds → site updates.

const data = (liveData as HomepageData).items?.length
  ? (liveData as HomepageData)
  : (mockData as HomepageData);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Banner({ message, mode }: { message: string; mode: string }) {
  const isError = mode === 'HARD_FAIL';
  return (
    <div className={`rounded-lg px-4 py-3 text-sm mb-6 flex items-start gap-2 ${
      isError
        ? 'bg-red-50 border border-red-200 text-red-700'
        : 'bg-amber-50 border border-amber-200 text-amber-700'
    }`}>
      <span className="flex-shrink-0 mt-0.5">{isError ? '🚫' : '⚠️'}</span>
      <span>{message}</span>
    </div>
  );
}

function CategoryChips({ items }: { items: HomepageData['items'] }) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {Object.entries(counts).map(([cat, n]) => (
        <span key={cat} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
          {cat} · {n}
        </span>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">今日 Top 10 好价</h1>
          <p className="text-sm text-gray-500">
            更新于 {formatDate(data.generated_at)} · 数据来自 Reddit / Slickdeals
          </p>
        </div>

        {data.banner && <Banner message={data.banner} mode={data.mode} />}

        {data.items.length > 0 && <CategoryChips items={data.items} />}

        {data.items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">今日暂无符合条件的折扣，请明日再来</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.items.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}

        <p className="mt-10 text-xs text-center text-gray-400">
          价格实时变动，点击链接以商家页面为准 · DealRadar 不参与任何交易
        </p>
      </main>
    </>
  );
}
