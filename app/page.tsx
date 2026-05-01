import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import DealListClient from '@/components/DealListClient';
import Sidebar from '@/components/Sidebar';
import type { HomepageData } from '@/lib/types';
import liveData from '@/data/homepage.json';
import mockData from '@/data/mock-homepage.json';

const data = (liveData as HomepageData).items?.length
  ? (liveData as HomepageData)
  : (mockData as HomepageData);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Banner({ message, mode }: { message: string; mode: string }) {
  const isError = mode === 'HARD_FAIL';
  return (
    <div className={`rounded-xl px-4 py-3 text-sm mb-6 flex items-start gap-2 ${
      isError
        ? 'bg-red-50 border border-red-200 text-red-700'
        : 'bg-amber-50 border border-amber-200 text-amber-700'
    }`}>
      <span className="flex-shrink-0 mt-0.5">{isError ? '🚫' : '⚠️'}</span>
      <span>{message}</span>
    </div>
  );
}

// Brand A/S tier deals only for the hero section
const heroDeals = (data.categories
  ? Object.values(data.categories).flat()
  : data.items
).filter(d => d.discount_pct > 0 && (d.brand_tier === 'S' || d.brand_tier === 'A'))
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">

        {/* ── Page header ── */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">今日品牌好价</h1>
          <p className="text-sm text-gray-500">
            更新于 {formatDate(data.generated_at)} · {
              data.category_counts
                ? `${Object.keys(data.category_counts).length} 个品类`
                : '多品类'
            } · 仅收录主流品牌折扣
          </p>
        </div>

        {data.banner && <Banner message={data.banner} mode={data.mode} />}

        {/* ── Hero: top 3 brand deals (large cards) ── */}
        {heroDeals.length > 0 && <HeroSection items={heroDeals} />}

        {/* ── Two-column layout: list + sidebar ── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Main list */}
          <div className="flex-1 min-w-0">
            <DealListClient items={data.items} categories={data.categories} />
          </div>

          {/* Sidebar (desktop only) */}
          <div className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-20">
              <Sidebar data={data} />
            </div>
          </div>

        </div>

        {/* ── Footer note ── */}
        <p className="mt-10 text-xs text-center text-gray-400">
          价格实时变动，以商家页面为准 · DealRadar 不参与任何交易，不含推广链接
        </p>
      </main>
    </>
  );
}
