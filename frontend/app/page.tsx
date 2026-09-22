import Link from 'next/link';

export const metadata = {
  title: 'Job Intelligence | Autonomous Opportunity Discovery & Precision Matching',
  description:
    'Production platform for autonomous career crawling, deterministic multi-dimensional candidate matching, and candidate intelligence operations.',
};

export default function HomePage() {
  return (
    <main className="mx-auto my-8 w-full max-w-5xl px-4 sm:my-16 sm:px-6">
      <header className="mb-12 flex flex-col gap-4 border-b border-slate-200 pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-block size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              System Operational · Production Active
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
            Job Intelligence
          </h1>
          <p className="mt-2 text-base text-slate-600 sm:text-lg">
            Autonomous career page ingestion, multi-dimensional candidate matching, and pipeline
            intelligence.
          </p>
        </div>
      </header>

      {/* Dual Portal Gateway */}
      <div className="grid gap-8 md:grid-cols-2">
        {/* Candidate Portal Card */}
        <section className="card flex flex-col justify-between border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-md">
          <div>
            <p className="eyebrow text-indigo-600">Candidate Gateway</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Candidate Workspace</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Personalized career matching tailored to your exact tech stack, expertise level,
              preferred work modes, and company blacklist filters.
            </p>

            <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-600">✓</span>
                <span>Deterministic match scoring across skills, location, and seniority</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-600">✓</span>
                <span>On-demand Quick Search & AI-enhanced vacancy verification</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-600">✓</span>
                <span>Target company tracking and daily email notifications</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100">
            <Link
              href="/candidate/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white no-underline transition hover:bg-slate-800"
            >
              Sign In to Candidate Portal →
            </Link>
          </div>
        </section>

        {/* Administrator Console Card */}
        <section className="card flex flex-col justify-between border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-md">
          <div>
            <p className="eyebrow text-slate-500">Operator Gateway</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Operations Console</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Full administrative visibility over autonomous career page crawlers, company directory
              curation, candidate quota policies, and ingestion logs.
            </p>

            <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-900">✓</span>
                <span>Autonomous crawler monitor with streaming decompression</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-900">✓</span>
                <span>1,050+ company catalog curation & category mapping</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-900">✓</span>
                <span>Redis sliding-window rate limiting & system telemetry</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100">
            <Link
              href="/admin"
              className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 no-underline transition hover:bg-slate-50"
            >
              Open Operations Console →
            </Link>
          </div>
        </section>
      </div>

      {/* Production Telemetry Highlights */}
      <footer className="mt-14 rounded-xl bg-slate-100/70 p-6 sm:p-8">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Architecture & System Highlights
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-2xl font-extrabold text-slate-950">1,051+</p>
            <p className="text-xs text-slate-500">Curated Companies</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-950">5-Layer</p>
            <p className="text-xs text-slate-500">Automated Testing</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-950">Sliding Window</p>
            <p className="text-xs text-slate-500">Redis Protection</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-950">PostgreSQL</p>
            <p className="text-xs text-slate-500">Neon Serverless DB</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
