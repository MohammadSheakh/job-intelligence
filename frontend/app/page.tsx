import Link from 'next/link';

export const metadata = {
  title: 'Job Intelligence | Autonomous Opportunity Discovery & Precision Matching',
  description:
    'Production platform for autonomous career crawling, deterministic multi-dimensional candidate matching, and candidate intelligence operations.',
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24 space-y-16">
        {/* Header */}
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-neutral-50/50 px-3.5 py-1 text-xs text-neutral-600">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium tracking-tight">OPERATIONS · DB NEON</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-neutral-950">
            Job Intelligence
          </h1>
          <p className="text-base sm:text-lg text-neutral-500 max-w-2xl">
            Autonomous career crawler, deterministic multi-dimensional candidate matching, and pipeline intelligence platform.
          </p>
        </header>

        {/* Dual Portal Gateway */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Candidate Portal Card */}
          <section className="flex flex-col justify-between p-8 rounded-3xl border border-neutral-200/80 bg-white hover:border-neutral-300 transition space-y-6">
            <div className="space-y-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Candidate Gateway
              </span>
              <h2 className="text-2xl font-bold text-neutral-950 tracking-tight">
                Candidate Workspace
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
                Personalized career matching tailored to your exact tech stack, expertise level, preferred work modes, and company blacklist filters.
              </p>

              <ul className="space-y-2 pt-2 text-xs text-neutral-600">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Deterministic match scoring across skills & seniority</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>On-demand Quick Search & vacancy verification</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Target company pipeline tracking</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t border-neutral-100">
              <Link
                href="/candidate/login"
                className="btn-pill-primary w-full py-2.5 text-center text-xs font-semibold block"
              >
                Sign In to Candidate Portal →
              </Link>
            </div>
          </section>

          {/* Administrator Console Card */}
          <section className="flex flex-col justify-between p-8 rounded-3xl border border-neutral-200/80 bg-white hover:border-neutral-300 transition space-y-6">
            <div className="space-y-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Operator Gateway
              </span>
              <h2 className="text-2xl font-bold text-neutral-950 tracking-tight">
                Operations Console
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
                Full administrative visibility over autonomous career page crawlers, company directory curation, candidate policies, and telemetry.
              </p>

              <ul className="space-y-2 pt-2 text-xs text-neutral-600">
                <li className="flex items-center gap-2">
                  <span className="text-neutral-900 font-bold">✓</span>
                  <span>Autonomous crawler monitor & live status checks</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-neutral-900 font-bold">✓</span>
                  <span>1,050+ company catalog curation & category mapping</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-neutral-900 font-bold">✓</span>
                  <span>Redis sliding-window rate limiting protection</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t border-neutral-100">
              <Link
                href="/admin"
                className="btn-pill-secondary w-full py-2.5 text-center text-xs font-semibold block"
              >
                Open Operations Console →
              </Link>
            </div>
          </section>
        </div>

        {/* Unboxed Stats Row */}
        <div className="pt-10 border-t border-neutral-100">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-6">
            System Telemetry & Architecture
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div>
              <p className="text-3xl font-extrabold text-neutral-950 tracking-tight">1,051+</p>
              <p className="text-xs text-neutral-500 mt-1">Curated Companies</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-neutral-950 tracking-tight">5-Layer</p>
              <p className="text-xs text-neutral-500 mt-1">Automated Testing</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-neutral-950 tracking-tight">Sliding Window</p>
              <p className="text-xs text-neutral-500 mt-1">Redis Rate Limiter</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-neutral-950 tracking-tight">PostgreSQL</p>
              <p className="text-xs text-neutral-500 mt-1">Neon Serverless DB</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
