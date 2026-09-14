import 'dotenv/config';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { closeDb, db } from '../db.js';
import { assertEnvironment, env } from '../config/env.js';
import { FERIO_CSS } from '../ui/ferio.js';
import { ensureCandidateDefaultPassword, setCandidatePassword } from '../auth/candidate-auth.js';
import { handlePortalRequest } from '../portal/routes.js';
import { getSettings, setSetting } from '../repositories/settings.js';
import {
  createCategory,
  getCandidateById,
  getCompanyById,
  getDashboardStats,
  getRecentCrawlLogs,
  listCandidates,
  listCategories,
  listCompanies,
  listCrawlLogs,
  listJobs,
  saveCandidate,
  replaceCompanyCategories,
  updateCompany,
} from './repository.js';

assertEnvironment('server');

const host = env.adminHost;
const port = env.adminPort;
const adminUsername = env.adminUsername;
const adminPassword = env.adminPassword;

function esc(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function checked(value: boolean): string {
  return value ? 'checked' : '';
}

function selected(value: string | null | undefined, expected: string): string {
  return value === expected ? 'selected' : '';
}

function authOk(req: IncomingMessage): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const index = decoded.indexOf(':');
    if (index < 0) return false;
    return decoded.slice(0, index) === adminUsername && decoded.slice(index + 1) === adminPassword;
  } catch {
    return false;
  }
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} · Job Intelligence</title>
<style>
${FERIO_CSS}
.shell{display:grid;grid-template-columns:210px minmax(0,1fr);min-height:100vh}
.side{background:var(--paper);border-right:1px solid var(--line);padding:24px 16px;position:sticky;top:0;height:100vh}
.brand{font-weight:700;font-size:16px;letter-spacing:-.015em;margin:0 8px 26px}.brand small{display:block;margin-top:3px;font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);font-weight:650}
.nav{display:grid;gap:2px}.nav a{display:block;padding:8px 9px;color:var(--muted);font-size:13px;border-radius:8px}.nav a:hover{background:var(--surface);color:var(--ink);text-decoration:none}
.main{padding:32px 34px 56px;max-width:1500px;width:100%}.top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:24px}.top h1{margin:0}.form-card{background:var(--paper);border-top:1px solid var(--line);padding:20px 0;max-width:980px}.actions{margin-top:18px}.dashboard-grid .card{border:0;border-top:1px solid var(--line);border-radius:0;padding:15px 0}.section h2{margin-bottom:10px}.category-box{background:transparent}.table-wrap{border-radius:0}.notice{max-width:980px}
@media(max-width:850px){.shell{grid-template-columns:1fr}.side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line);padding:12px 14px}.brand{margin:0 0 9px}.nav{display:flex;overflow:auto;gap:4px}.nav a{white-space:nowrap}.main{padding:22px 14px 44px}.form-grid{grid-template-columns:1fr}}
</style>
</head>
<body><div class="shell"><aside class="side"><div class="brand">Job Intelligence<small>Operations · DB ${esc(env.databaseMode.toUpperCase())}</small></div><nav class="nav">
<a href="/">Dashboard</a><a href="/companies">Companies</a><a href="/categories">Categories</a><a href="/jobs">Jobs</a><a href="/candidates">Candidates</a><a href="/crawl-logs">Crawler</a><a href="/settings">Settings</a>
</nav></aside><main class="main">${body}</main></div></body></html>`;
}

function send(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
}

function redirect(res: ServerResponse, location: string): void {
  res.writeHead(303, { location });
  res.end();
}

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function pageNumber(url: URL): number {
  const n = Number(url.searchParams.get('page') ?? '1');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function pager(path: string, page: number, pageSize: number, total: number, params: Record<string, string | undefined>): string {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const makeUrl = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    search.set('page', String(target));
    return `${path}?${search.toString()}`;
  };
  return `<div class="pager">${page > 1 ? `<a class="btn secondary" href="${esc(makeUrl(page - 1))}">Previous</a>` : ''}<span class="muted">Page ${page} of ${pages} · ${total} records</span>${page < pages ? `<a class="btn secondary" href="${esc(makeUrl(page + 1))}">Next</a>` : ''}</div>`;
}

async function dashboard(res: ServerResponse): Promise<void> {
  const [stats, settings, logs] = await Promise.all([getDashboardStats(), getSettings(), getRecentCrawlLogs(8)]);
  const body = `<div class="top"><div><h1>Dashboard</h1><div class="muted">Live Neon-backed MVP status</div></div></div>
  <div class="grid dashboard-grid">
    <div class="card"><div class="micro">Companies</div><div class="metric">${stats.companies}</div></div>
    <div class="card"><div class="micro">Monitor ready</div><div class="metric">${stats.monitorReady}</div></div>
    <div class="card"><div class="micro">Open jobs</div><div class="metric">${stats.openJobs}</div></div>
    <div class="card"><div class="micro">Active candidates</div><div class="metric">${stats.candidates}</div></div>
    <div class="card"><div class="micro">Notifications sent</div><div class="metric">${stats.notifications}</div></div>
    <div class="card"><div class="micro">Crawler failures / 24h</div><div class="metric">${stats.crawlFailures24h}</div></div>
  </div>
  <div class="section"><h2>Controls</h2><div class="grid">
    <div class="card"><div class="muted">AI</div><div class="metric" style="font-size:20px">${settings.aiEnabled ? '<span class="pill ok">ON</span>' : '<span class="pill">OFF</span>'}</div><div class="muted">Matching: ${settings.aiMatchingEnabled ? 'enabled' : 'disabled'} · daily limit ${settings.aiDailyLimit}</div></div>
    <div class="card"><div class="muted">Email</div><div class="metric" style="font-size:20px">${settings.emailEnabled ? '<span class="pill ok">ON</span>' : '<span class="pill">OFF</span>'}</div><div class="muted">Default match threshold ${settings.defaultMatchThreshold}%</div></div>
  </div></div>
  <div class="section"><h2>Recent crawler activity</h2><div class="table-wrap">${logs.length ? `<table><thead><tr><th>Company</th><th>Checked</th><th>Status</th><th>Jobs</th><th>Error</th></tr></thead><tbody>${logs.map((log) => `<tr><td>${esc(log.companyName)}</td><td>${esc(fmtDate(log.checkedAt))}</td><td>${log.success ? '<span class="pill ok">Success</span>' : '<span class="pill bad">Failed</span>'}</td><td>${log.jobsFound}</td><td>${esc(log.error ?? '—')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No crawler runs yet.</div>'}</div></div>`;
  send(res, 200, layout('Dashboard', body));
}

async function companiesPage(url: URL, res: ServerResponse): Promise<void> {
  const page = pageNumber(url);
  const search = url.searchParams.get('q') ?? '';
  const action = url.searchParams.get('action') ?? '';
  const category = url.searchParams.get('category') ?? '';
  const pageSize = 50;
  const [data, categories] = await Promise.all([listCompanies({ search, action, category, page, pageSize }), listCategories()]);
  const rows = data.rows.map((company) => `<tr>
    <td><a href="/companies/${encodeURIComponent(company.id)}"><strong>${esc(company.name)}</strong></a><div class="muted code">${esc(company.websiteUrl ?? '')}</div></td>
    <td>${esc(company.location ?? '—')}</td>
    <td><div class="chips">${company.categories.length ? company.categories.map((name) => `<span class="chip">${esc(name)}</span>`).join('') : '—'}</div></td>
    <td>${company.careerUrl ? `<a href="${esc(company.careerUrl)}" target="_blank" rel="noreferrer">Career page</a>` : '—'}</td>
    <td>${company.recommendedAction === 'NO_HIRING_PAGE_FOUND' ? '<span class="pill warn">NHPF</span>' : esc(company.recommendedAction ?? '—')}</td>
    <td>${company.active ? '<span class="pill ok">Active</span>' : '<span class="pill">Disabled</span>'}${company.needsManualReview ? ' <span class="pill warn">Review</span>' : ''}</td>
    <td>${esc(fmtDate(company.lastCheckedAt))}</td>
  </tr>`).join('');
  const categoryOptions = categories.map((c) => `<option value="${esc(c.name)}" ${selected(category, c.name)}>${esc(c.name)} (${c.companyCount})</option>`).join('');
  const body = `<div class="top"><div><h1>Companies</h1><div class="muted">Research data, categories and crawler targets</div></div></div>
  <form class="toolbar" method="get"><div class="field"><label>Search<input class="input" name="q" value="${esc(search)}" placeholder="Company, domain, location" /></label></div><div class="field"><label>Category<select name="category"><option value="">All categories</option>${categoryOptions}</select></label></div><div class="field"><label>Action<select name="action"><option value="">All</option><option ${selected(action, 'MONITOR_READY')}>MONITOR_READY</option><option ${selected(action, 'FIND_CAREER_PAGE')}>FIND_CAREER_PAGE</option><option ${selected(action, 'NO_HIRING_PAGE_FOUND')}>NO_HIRING_PAGE_FOUND</option><option ${selected(action, 'ENRICH_FROM_LINKEDIN')}>ENRICH_FROM_LINKEDIN</option><option ${selected(action, 'MANUAL_REVIEW')}>MANUAL_REVIEW</option></select></label></div><button class="btn">Filter</button></form>
  <div class="table-wrap">${rows ? `<table><thead><tr><th>Company</th><th>Location</th><th>Categories</th><th>Career</th><th>Action</th><th>Status</th><th>Last checked</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No companies found.</div>'}</div>
  ${pager('/companies', page, pageSize, data.total, { q: search, action, category })}`;
  send(res, 200, layout('Companies', body));
}

async function companyEditPage(id: string, res: ServerResponse): Promise<void> {
  const [company, categories] = await Promise.all([getCompanyById(id), listCategories()]);
  if (!company) return send(res, 404, layout('Not found', '<div class="empty">Company not found.</div>'));
  const selectedCategories = new Set(company.categories);
  const grouped = new Map<string, typeof categories>();
  for (const category of categories) {
    if (category.name === 'Other') continue;
    const list = grouped.get(category.type) ?? [];
    list.push(category);
    grouped.set(category.type, list);
  }
  const categoryBoxes = ['technology','domain','sector','other'].map((type) => {
    const items = grouped.get(type) ?? [];
    if (!items.length) return '';
    return `<div class="category-box"><h3>${esc(type[0].toUpperCase() + type.slice(1))}</h3><div class="check-list">${items.map((cat) => `<label><input type="checkbox" name="category" value="${esc(cat.name)}" ${checked(selectedCategories.has(cat.name))}/> ${esc(cat.name)}</label>`).join('')}</div></div>`;
  }).join('');
  const body = `<div class="top"><div><h1>Edit company</h1><div class="muted code">${esc(company.id)}</div></div><a class="btn secondary" href="/companies">Back</a></div>
  ${company.recommendedAction === 'NO_HIRING_PAGE_FOUND' ? '<div class="notice"><strong>NHPF:</strong> No Hiring Page Found. This company is excluded from the daily career-page crawler until a real hiring page is added.</div>' : ''}
  <form class="form-card" method="post"><div class="form-grid">
    <label>Name<input class="input" required name="name" value="${esc(company.name)}" /></label>
    <label>Location<input class="input" name="location" value="${esc(company.location ?? '')}" /></label>
    <label>Website URL<input class="input" name="website_url" value="${esc(company.websiteUrl ?? '')}" /></label>
    <label>Career URL<input class="input" name="career_url" value="${esc(company.careerUrl ?? '')}" /></label>
    <label>LinkedIn URL<input class="input" name="linkedin_url" value="${esc(company.linkedinUrl ?? '')}" /></label>
    <label>Email<input class="input" type="email" name="email" value="${esc(company.email ?? '')}" /></label>
    <label class="wide">Tech stack / raw research<input class="input" name="tech_stack" value="${esc(company.techStack ?? '')}" /></label>
    <label>Workflow status<select name="recommended_action"><option value="">—</option><option ${selected(company.recommendedAction, 'MONITOR_READY')}>MONITOR_READY</option><option ${selected(company.recommendedAction, 'FIND_CAREER_PAGE')}>FIND_CAREER_PAGE</option><option ${selected(company.recommendedAction, 'NO_HIRING_PAGE_FOUND')}>NO_HIRING_PAGE_FOUND</option><option ${selected(company.recommendedAction, 'ENRICH_FROM_LINKEDIN')}>ENRICH_FROM_LINKEDIN</option><option ${selected(company.recommendedAction, 'MANUAL_REVIEW')}>MANUAL_REVIEW</option></select></label>
    <label>Research status<input class="input" name="status_research_hint" value="${esc(company.statusResearchHint ?? '')}" /></label>
    <label class="checkbox"><input type="checkbox" name="active" value="true" ${checked(company.active)} /> Active</label>
    <div class="wide"><div style="font-size:12px;color:#475569;font-weight:700;margin-bottom:6px">Categories</div><div class="category-grid">${categoryBoxes}</div></div>
    <label class="wide">Notes<textarea class="input" rows="5" name="notes">${esc(company.notes ?? '')}</textarea></label>
  </div><div class="actions"><button class="btn">Save company</button></div></form>`;
  send(res, 200, layout(`Edit ${company.name}`, body));
}

async function categoriesPage(res: ServerResponse, notice = ''): Promise<void> {
  const categories = await listCategories();
  const groups = ['technology','domain','sector','other'].map((type) => {
    const rows = categories.filter((c) => c.type === type).map((c) => `<tr><td><a href="/companies?category=${encodeURIComponent(c.name)}">${esc(c.name)}</a></td><td>${c.companyCount}</td></tr>`).join('');
    return `<div class="section"><h2>${esc(type[0].toUpperCase() + type.slice(1))}</h2><div class="table-wrap"><table><thead><tr><th>Category</th><th>Companies</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }).join('');
  const form = `<form class="form-card" method="post" action="/categories"><div class="form-grid"><label>New category<input class="input" required name="name" placeholder="e.g. Generative AI" /></label><label>Type<select name="type"><option value="technology">Technology</option><option value="domain">Domain</option><option value="sector">Sector</option><option value="other">Other</option></select></label></div><div class="actions"><button class="btn">Add category</button></div></form>`;
  send(res, 200, layout('Categories', `<div class="top"><div><h1>Categories</h1><div class="muted">Technology, domain and sector classification</div></div></div>${notice ? `<div class="notice">${esc(notice)}</div>` : ''}${form}${groups}`));
}

async function jobsPage(url: URL, res: ServerResponse): Promise<void> {
  const page = pageNumber(url);
  const search = url.searchParams.get('q') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const pageSize = 50;
  const data = await listJobs({ search, status, page, pageSize });
  const rows = data.rows.map((job) => `<tr><td><strong>${esc(job.title)}</strong><div class="muted">${esc(job.companyName)}</div>${job.companyCategories.length ? `<div class="chips" style="margin-top:6px">${job.companyCategories.map((name) => `<span class="chip">${esc(name)}</span>`).join('')}</div>` : ''}</td><td>${esc(job.location ?? '—')}</td><td>${esc(job.workMode ?? '—')}</td><td>${job.status === 'OPEN' ? '<span class="pill ok">OPEN</span>' : '<span class="pill">CLOSED</span>'}</td><td>${esc(fmtDate(job.firstSeenAt))}</td><td>${job.applicationUrl ? `<a href="${esc(job.applicationUrl)}" target="_blank" rel="noreferrer">Apply</a>` : '—'}</td></tr>`).join('');
  const body = `<div class="top"><div><h1>Jobs</h1><div class="muted">Discovered and deduplicated openings</div></div></div>
  <form class="toolbar" method="get"><div class="field"><label>Search<input class="input" name="q" value="${esc(search)}" placeholder="Job, company, location" /></label></div><div class="field"><label>Status<select name="status"><option value="">All</option><option ${selected(status, 'OPEN')}>OPEN</option><option ${selected(status, 'CLOSED')}>CLOSED</option></select></label></div><button class="btn">Filter</button></form>
  <div class="table-wrap">${rows ? `<table><thead><tr><th>Job</th><th>Location</th><th>Mode</th><th>Status</th><th>First seen</th><th>Link</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No jobs yet. Run the crawler first.</div>'}</div>${pager('/jobs', page, pageSize, data.total, { q: search, status })}`;
  send(res, 200, layout('Jobs', body));
}

function candidateForm(candidate: Awaited<ReturnType<typeof getCandidateById>> | null | undefined, categories: Awaited<ReturnType<typeof listCategories>>): string {
  const c = candidate ?? null;
  const preferredSet = new Set((c?.preferredCategories ?? '').split(',').map((x) => x.trim()).filter(Boolean));
  const excludedSet = new Set((c?.excludedCategories ?? '').split(',').map((x) => x.trim()).filter(Boolean));
  const relevant = categories.filter((cat) => cat.name !== 'Other');
  const categoryBoxes = ['technology','domain','sector','other'].map((type) => {
    const items = relevant.filter((cat) => cat.type === type);
    if (!items.length) return '';
    return `<div class="category-box"><h3>${esc(type[0].toUpperCase() + type.slice(1))}</h3><div class="check-list">${items.map((cat) => `<div style="width:100%;display:flex;justify-content:space-between;gap:8px"><span>${esc(cat.name)}</span><span><label><input type="checkbox" name="preferred_category" value="${esc(cat.name)}" ${checked(preferredSet.has(cat.name))}/> Prefer</label> <label><input type="checkbox" name="excluded_category" value="${esc(cat.name)}" ${checked(excludedSet.has(cat.name))}/> Exclude</label></span></div>`).join('')}</div></div>`;
  }).join('');
  return `<form class="form-card" method="post" action="/candidates/save"><input type="hidden" name="id" value="${esc(c?.id ?? '')}" /><div class="form-grid">
  <label>Name<input class="input" required name="name" value="${esc(c?.name ?? '')}" /></label>
  <label>Email<input class="input" required type="email" name="email" value="${esc(c?.email ?? '')}" /></label>
  <label>Expertise<input class="input" name="expertise" placeholder="Backend Developer" value="${esc(c?.expertise ?? '')}" /></label>
  <label>Experience level<input class="input" name="experience_level" placeholder="junior / mid / senior" value="${esc(c?.experienceLevel ?? '')}" /></label>
  <label class="wide">Skills<input class="input" name="skills" placeholder="Node.js, TypeScript, PostgreSQL" value="${esc(c?.skills ?? '')}" /></label>
  <label>Preferred locations<input class="input" name="preferred_locations" placeholder="Gulshan, Badda" value="${esc(c?.preferredLocations ?? '')}" /></label>
  <label>Excluded locations<input class="input" name="excluded_locations" placeholder="Uttara, Savar" value="${esc(c?.excludedLocations ?? '')}" /></label>
  <label>Preferred work modes<input class="input" name="preferred_work_modes" placeholder="Remote, Hybrid" value="${esc(c?.preferredWorkModes ?? '')}" /></label>
  <label>Minimum match score<input class="input" type="number" min="0" max="100" name="minimum_match_score" value="${esc(c?.minimumMatchScore ?? 70)}" /></label>
  <label>Set / reset login password<input class="input" type="password" name="new_password" minlength="8" autocomplete="new-password" placeholder="New candidates default to asdfasdf" /></label>
  <div class="wide"><div style="font-size:12px;color:#475569;font-weight:700;margin-bottom:6px">Category preferences</div><div class="muted" style="margin-bottom:10px">Sector exclusions are hard filters. Technology/domain exclusions only block jobs that explicitly match that category.</div><div class="category-grid">${categoryBoxes}</div></div>
  <label class="checkbox"><input type="checkbox" name="active" value="true" ${checked(c?.active ?? true)} /> Active</label>
  </div><div class="actions"><button class="btn">${c ? 'Save candidate' : 'Add candidate'}</button>${c ? '<a class="btn secondary" href="/candidates">Cancel</a>' : ''}</div></form>`;
}

async function candidatesPage(url: URL, res: ServerResponse): Promise<void> {
  const editId = Number(url.searchParams.get('edit') ?? '0');
  const [candidates, editCandidate, categories] = await Promise.all([listCandidates(), editId > 0 ? getCandidateById(editId) : Promise.resolve(null), listCategories()]);
  const rows = candidates.map((c) => `<tr><td><strong>${esc(c.name)}</strong><div class="muted">${esc(c.email)}</div></td><td>${esc(c.expertise ?? '—')}</td><td>${esc(c.skills ?? '—')}</td><td><div>${esc(c.preferredLocations ?? '—')}</div>${c.preferredCategories ? `<div class="chips" style="margin-top:6px">${c.preferredCategories.split(',').map((x) => `<span class="chip ok">${esc(x.trim())}</span>`).join('')}</div>` : ''}</td><td><div>${esc(c.excludedLocations ?? '—')}</div>${c.excludedCategories ? `<div class="chips" style="margin-top:6px">${c.excludedCategories.split(',').map((x) => `<span class="chip bad">${esc(x.trim())}</span>`).join('')}</div>` : ''}</td><td>${c.minimumMatchScore}%</td><td><div class="chips">${c.hasPassword ? '<span class="chip ok">Password</span>' : ''}${c.hasGoogle ? '<span class="chip ok">Google</span>' : ''}${!c.hasPassword && !c.hasGoogle ? '<span class="muted">Not enabled</span>' : ''}</div></td><td>${c.active ? '<span class="pill ok">Active</span>' : '<span class="pill">Disabled</span>'}</td><td><a href="/candidates?edit=${c.id}">Edit</a></td></tr>`).join('');
  const body = `<div class="top"><div><h1>Candidates</h1><div class="muted">Profiles used by the matching engine</div></div></div>
  ${candidateForm(editCandidate, categories)}
  <div class="section"><h2>Candidate list</h2><div class="table-wrap">${rows ? `<table><thead><tr><th>Candidate</th><th>Expertise</th><th>Skills</th><th>Preferred</th><th>Excluded</th><th>Threshold</th><th>Auth</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No candidates yet.</div>'}</div></div>`;
  send(res, 200, layout('Candidates', body));
}

async function crawlLogsPage(url: URL, res: ServerResponse): Promise<void> {
  const page = pageNumber(url);
  const pageSize = 100;
  const data = await listCrawlLogs(page, pageSize);
  const rows = data.rows.map((log) => `<tr><td>${esc(log.companyName)}</td><td>${esc(fmtDate(log.checkedAt))}</td><td>${log.success ? '<span class="pill ok">Success</span>' : '<span class="pill bad">Failed</span>'}</td><td>${log.jobsFound}</td><td>${esc(log.error ?? '—')}</td></tr>`).join('');
  const body = `<div class="top"><div><h1>Crawler</h1><div class="muted">Recent career-page checks</div></div></div><div class="notice">This page is monitoring only. Run the crawler through the scheduled worker or <span class="code">npm run crawl:daily</span>.</div><div class="table-wrap">${rows ? `<table><thead><tr><th>Company</th><th>Checked</th><th>Status</th><th>Jobs found</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No crawl logs yet.</div>'}</div>${pager('/crawl-logs', page, pageSize, data.total, {})}`;
  send(res, 200, layout('Crawler', body));
}

async function settingsPage(res: ServerResponse, notice = ''): Promise<void> {
  const s = await getSettings();
  const body = `<div class="top"><div><h1>Settings</h1><div class="muted">Cost and notification controls</div></div></div>${notice ? `<div class="notice">${esc(notice)}</div>` : ''}<form class="form-card" method="post"><div class="form-grid">
  <label class="checkbox"><input type="checkbox" name="ai_enabled" value="true" ${checked(s.aiEnabled)} /> AI enabled</label>
  <label class="checkbox"><input type="checkbox" name="ai_matching_enabled" value="true" ${checked(s.aiMatchingEnabled)} /> AI matching enabled</label>
  <label>AI provider<input class="input" name="ai_provider" value="${esc(s.aiProvider)}" placeholder="local / openai-compatible" /></label>
  <label>Daily AI call limit<input class="input" type="number" min="0" name="ai_daily_limit" value="${s.aiDailyLimit}" /></label>
  <label class="checkbox"><input type="checkbox" name="ai_skill_extraction_enabled" value="true" ${checked(s.aiSkillExtractionEnabled)} /> AI skill extraction enabled</label>
  <label>Default match threshold<input class="input" type="number" min="0" max="100" name="default_match_threshold" value="${s.defaultMatchThreshold}" /></label>
  <label class="checkbox"><input type="checkbox" name="email_enabled" value="true" ${checked(s.emailEnabled)} /> Email sending enabled</label>
  <label>Quick searches / candidate / day<input class="input" type="number" min="0" max="20" name="quick_search_daily_limit" value="${s.quickSearchDailyLimit}" /></label>
  <label>AI quick searches / candidate / day<input class="input" type="number" min="0" max="20" name="quick_search_ai_daily_limit" value="${s.quickSearchAiDailyLimit}" /></label>
  <label>Companies checked per quick search<input class="input" type="number" min="1" max="25" name="quick_search_company_limit" value="${s.quickSearchCompanyLimit}" /></label>
  </div><div class="actions"><button class="btn">Save settings</button></div></form>`;
  send(res, 200, layout('Settings', body));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    try {
      await db.query('SELECT 1');
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ status: 'ok', database: 'ok', databaseMode: env.databaseMode }));
    } catch {
      res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ status: 'unavailable', database: 'error', databaseMode: env.databaseMode }));
    }
  }
  if (url.pathname.startsWith('/portal') || url.pathname.startsWith('/auth/google')) {
    await handlePortalRequest(req, res, url);
    return;
  }
  if (!authOk(req)) {
    res.writeHead(401, { 'www-authenticate': 'Basic realm="Job Intelligence Admin"', 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Authentication required');
  }

  try {
    if (req.method === 'GET' && url.pathname === '/') return await dashboard(res);
    if (req.method === 'GET' && url.pathname === '/companies') return await companiesPage(url, res);
    if (req.method === 'GET' && url.pathname === '/categories') return await categoriesPage(res);
    if (req.method === 'POST' && url.pathname === '/categories') {
      const form = await readForm(req);
      const typeRaw = form.get('type') ?? 'other';
      const type = ['technology','domain','sector','other'].includes(typeRaw) ? typeRaw as 'technology'|'domain'|'sector'|'other' : 'other';
      await createCategory(form.get('name') ?? '', type);
      return await categoriesPage(res, 'Category saved.');
    }
    if (req.method === 'GET' && /^\/companies\/[^/]+$/.test(url.pathname)) return await companyEditPage(decodeURIComponent(url.pathname.slice('/companies/'.length)), res);
    if (req.method === 'POST' && /^\/companies\/[^/]+$/.test(url.pathname)) {
      const id = decodeURIComponent(url.pathname.slice('/companies/'.length));
      const form = await readForm(req);
      const categories = form.getAll('category').filter(Boolean);
      await updateCompany({
        id,
        name: form.get('name') ?? '',
        websiteUrl: form.get('website_url') ?? '',
        careerUrl: form.get('career_url') ?? '',
        linkedinUrl: form.get('linkedin_url') ?? '',
        email: form.get('email') ?? '',
        location: form.get('location') ?? '',
        techStack: form.get('tech_stack') ?? '',
        notes: form.get('notes') ?? '',
        recommendedAction: form.get('recommended_action') ?? '',
        statusResearchHint: form.get('status_research_hint') ?? '',
        active: form.get('active') === 'true',
      });
      await replaceCompanyCategories(id, categories);
      return redirect(res, `/companies/${encodeURIComponent(id)}`);
    }
    if (req.method === 'GET' && url.pathname === '/jobs') return await jobsPage(url, res);
    if (req.method === 'GET' && url.pathname === '/candidates') return await candidatesPage(url, res);
    if (req.method === 'POST' && url.pathname === '/candidates/save') {
      const form = await readForm(req);
      const rawId = Number(form.get('id') ?? '0');
      const score = Math.max(0, Math.min(100, Number(form.get('minimum_match_score') ?? '70') || 70));
      const excludedCategories = form.getAll('excluded_category').filter(Boolean);
      const excludedCategorySet = new Set(excludedCategories);
      const preferredCategories = form.getAll('preferred_category').filter((name) => name && !excludedCategorySet.has(name));
      const candidateId = await saveCandidate({
        id: rawId > 0 ? rawId : undefined,
        name: form.get('name') ?? '',
        email: form.get('email') ?? '',
        expertise: form.get('expertise') ?? '',
        skills: form.get('skills') ?? '',
        experienceLevel: form.get('experience_level') ?? '',
        preferredLocations: form.get('preferred_locations') ?? '',
        excludedLocations: form.get('excluded_locations') ?? '',
        preferredWorkModes: form.get('preferred_work_modes') ?? '',
        preferredCategories: preferredCategories.join(', '),
        excludedCategories: excludedCategories.join(', '),
        minimumMatchScore: score,
        active: form.get('active') === 'true',
      });
      const newPassword = form.get('new_password') ?? '';
      if (newPassword) await setCandidatePassword(candidateId, newPassword, { mustChange: true });
      else await ensureCandidateDefaultPassword(candidateId);
      return redirect(res, '/candidates');
    }
    if (req.method === 'GET' && url.pathname === '/crawl-logs') return await crawlLogsPage(url, res);
    if (req.method === 'GET' && url.pathname === '/settings') return await settingsPage(res);
    if (req.method === 'POST' && url.pathname === '/settings') {
      const form = await readForm(req);
      const values: Array<[string, string]> = [
        ['ai_enabled', String(form.get('ai_enabled') === 'true')],
        ['ai_matching_enabled', String(form.get('ai_matching_enabled') === 'true')],
        ['ai_provider', form.get('ai_provider') ?? ''],
        ['ai_daily_limit', String(Math.max(0, Number(form.get('ai_daily_limit') ?? '0') || 0))],
        ['ai_skill_extraction_enabled', String(form.get('ai_skill_extraction_enabled') === 'true')],
        ['default_match_threshold', String(Math.max(0, Math.min(100, Number(form.get('default_match_threshold') ?? '70') || 70)))],
        ['email_enabled', String(form.get('email_enabled') === 'true')],
        ['quick_search_daily_limit', String(Math.max(0, Math.min(20, Number(form.get('quick_search_daily_limit') ?? '3') || 3)))],
        ['quick_search_ai_daily_limit', String(Math.max(0, Math.min(20, Number(form.get('quick_search_ai_daily_limit') ?? '1') || 1)))],
        ['quick_search_company_limit', String(Math.max(1, Math.min(25, Number(form.get('quick_search_company_limit') ?? '8') || 8)))],
      ];
      for (const [key, value] of values) await setSetting(key, value);
      return await settingsPage(res, 'Settings saved.');
    }
    return send(res, 404, layout('Not found', '<div class="empty">Page not found.</div>'));
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    return send(res, 500, layout('Error', `<div class="card"><h2>Request failed</h2><div class="code">${esc(message)}</div></div>`));
  }
}

const server = createServer((req, res) => { void handle(req, res); });
server.listen(port, host, () => {
  console.log(`Admin UI running at http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void closeDb().finally(() => process.exit(0));
    });
  });
}
