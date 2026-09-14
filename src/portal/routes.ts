import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { authenticateCandidate, findOrBindGoogleCandidate, getCandidateById, setCandidatePassword } from '../auth/candidate-auth.js';
import { createSignedSession, verifySignedSession } from '../auth/session.js';
import { exchangeGoogleCode, googleAuthorizationUrl, googleLoginEnabled } from '../auth/google.js';
import { getSettings } from '../repositories/settings.js';
import { getQuickSearchUsage } from '../repositories/search-runs.js';
import { runCandidateQuickSearch } from './quick-search.js';
import { getPortalRecommendations } from './recommendations.js';
import { FERIO_CSS } from '../ui/ferio.js';
import { getPortalCandidateProfile, getTrackingCounts, listPortalCategories, listPortalCategoryCatalog, listTrackedCompanies, removeCompanyTracking, saveCompanyTracking, searchCompaniesForCandidate, updatePortalCandidateProfile } from './repository.js';

const sessionCookie='ji_candidate_session';
const googleStateCookie='ji_google_state';

function esc(value:unknown):string{return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function parseCookies(req:IncomingMessage):Record<string,string>{const out:Record<string,string>={};for(const part of (req.headers.cookie??'').split(';')){const i=part.indexOf('=');if(i<0)continue;out[decodeURIComponent(part.slice(0,i).trim())]=decodeURIComponent(part.slice(i+1).trim());}return out;}
function secureCookie():boolean{return (process.env.COOKIE_SECURE??'').toLowerCase()==='true'||(process.env.PUBLIC_BASE_URL??'').startsWith('https://');}
function cookie(name:string,value:string,opts:{maxAge?:number;expires?:Date;httpOnly?:boolean}={}):string{const bits=[`${encodeURIComponent(name)}=${encodeURIComponent(value)}`,'Path=/','SameSite=Lax'];if(opts.httpOnly!==false)bits.push('HttpOnly');if(secureCookie())bits.push('Secure');if(opts.maxAge!==undefined)bits.push(`Max-Age=${opts.maxAge}`);if(opts.expires)bits.push(`Expires=${opts.expires.toUTCString()}`);return bits.join('; ');}
function send(res:ServerResponse,status:number,html:string,headers:Record<string,string|string[]>={}):void{res.writeHead(status,{'content-type':'text/html; charset=utf-8','cache-control':'no-store',...headers});res.end(html);}
function redirect(res:ServerResponse,location:string,headers:Record<string,string|string[]>={}):void{res.writeHead(303,{location,...headers});res.end();}
async function readForm(req:IncomingMessage):Promise<URLSearchParams>{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));}

function layout(title:string,body:string,identity?:{name:string}):string{return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Job Intelligence</title><style>
${FERIO_CSS}
.portal-topbar{border-bottom:1px solid var(--line);background:var(--paper)}
.portal-bar{max-width:1180px;margin:0 auto;padding:15px 24px;display:flex;justify-content:space-between;align-items:center;gap:18px}
.brand{font-weight:700;letter-spacing:-.015em}.brand small{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:650;margin-left:8px}
.nav{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.nav>a{font-size:13px;color:var(--muted)}.nav>a:hover{color:var(--ink)}.nav form{margin:0}.identity{font-size:12px;color:var(--muted)}
.wrap{max-width:1180px;margin:0 auto;padding:32px 24px 56px}.login{max-width:420px;margin:64px auto}.login .card{padding:24px}
.dashboard-stats .card{border:0;border-top:1px solid var(--line);border-radius:0;padding:15px 0}.quick-panel{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:18px 0}.quick-panel p{margin-bottom:0}.quick-usage{font-size:12px;color:var(--muted);margin-top:7px}
.profile-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 26px;border-top:1px solid var(--line)}
.profile-summary .kv:nth-last-child(-n+2){border-bottom:0}
@media(max-width:760px){.portal-bar{padding:12px 14px;align-items:flex-start;flex-direction:column}.nav{gap:11px}.wrap{padding:22px 14px 44px}.quick-panel{grid-template-columns:1fr}.profile-summary{grid-template-columns:1fr}.profile-summary .kv{border-bottom:1px solid var(--line)}}
</style></head><body><header class="portal-topbar"><div class="portal-bar"><div class="brand">Job Intelligence<small>Candidate</small></div>${identity?`<nav class="nav"><a href="/portal">Home</a><a href="/portal/companies">Companies</a><a href="/portal/pipeline">Pipeline</a><a href="/portal/profile">Profile</a><span class="identity">${esc(identity.name)}</span><form method="post" action="/portal/logout"><button class="btn ghost">Log out</button></form></nav>`:''}</div></header><main class="wrap">${body}</main></body></html>`;}

async function identity(req:IncomingMessage){const token=parseCookies(req)[sessionCookie]??'';const candidateId=verifySignedSession(token);const user=candidateId?await getCandidateById(candidateId):null;return {user};}
function loginPage(message=''):string{return layout('Candidate login',`<div class="login card"><h1>Candidate login</h1><p class="muted">Use the email your admin added to Job Intelligence.</p>${message?`<div class="notice error">${esc(message)}</div>`:''}<form method="post" action="/portal/login"><label>Email<input class="input" type="email" name="email" required autocomplete="email"></label><div style="height:12px"></div><label>Password<input class="input" type="password" name="password" required autocomplete="current-password"></label><div style="height:16px"></div><button class="btn" style="width:100%">Login</button></form>${googleLoginEnabled()?`<div style="text-align:center;margin:14px 0" class="muted">or</div><a class="btn secondary" style="display:block;text-align:center" href="/auth/google/start">Continue with Google</a>`:`<p class="muted" style="font-size:12px;margin-top:16px">Google login becomes available after Google OAuth is configured.</p>`}</div>`);}
function companyActions(companyId:string,current:string|null,returnTo='/portal/companies'):string{return `<div class="actions"><form method="post" action="/portal/company-state"><input type="hidden" name="company_id" value="${esc(companyId)}"><input type="hidden" name="return_to" value="${esc(returnTo)}"><input type="hidden" name="status" value="PLANNING"><button class="btn secondary">${current==='PLANNING'?'Planning':'Plan'}</button></form><form method="post" action="/portal/company-state"><input type="hidden" name="company_id" value="${esc(companyId)}"><input type="hidden" name="return_to" value="${esc(returnTo)}"><input type="hidden" name="status" value="APPLIED"><button class="btn ${current==='APPLIED'?'success':''}">Applied</button></form><form method="post" action="/portal/company-state"><input type="hidden" name="company_id" value="${esc(companyId)}"><input type="hidden" name="return_to" value="${esc(returnTo)}"><input type="hidden" name="status" value="EXCLUDED"><button class="btn danger">Blacklist</button></form></div>`;}
function trackingPill(status:string|null):string{if(!status)return '—';if(status==='APPLIED')return '<span class="status success">Applied</span>';if(status==='PLANNING')return '<span class="status pending">Planning</span>';if(status==='EXCLUDED')return '<span class="status error">Blacklist</span>';return `<span class="status">${esc(status)}</span>`;}

export async function handlePortalRequest(req:IncomingMessage,res:ServerResponse,url:URL):Promise<void>{
  try{
    if(req.method==='GET'&&url.pathname==='/portal/login'){const {user}=await identity(req);if(user)return redirect(res,user.mustChangePassword?'/portal/change-password':'/portal');return send(res,200,loginPage(url.searchParams.get('error')??''));}
    if(req.method==='POST'&&url.pathname==='/portal/login'){
      const form=await readForm(req);const user=await authenticateCandidate(form.get('email')??'',form.get('password')??'');
      if(!user)return send(res,401,loginPage('Invalid email or password.'));
      const session=createSignedSession(user.id);return redirect(res,user.mustChangePassword?'/portal/change-password':'/portal',{'set-cookie':cookie(sessionCookie,session.token,{expires:session.expiresAt})});
    }
    if(req.method==='GET'&&url.pathname==='/auth/google/start'){
      if(!googleLoginEnabled())return redirect(res,'/portal/login?error=Google+login+is+not+configured');
      const state=randomBytes(24).toString('base64url');res.writeHead(302,{location:googleAuthorizationUrl(state),'set-cookie':cookie(googleStateCookie,state,{maxAge:600})});res.end();return;
    }
    if(req.method==='GET'&&url.pathname==='/auth/google/callback'){
      const cookies=parseCookies(req),state=url.searchParams.get('state')??'',code=url.searchParams.get('code')??'';
      if(!state||state!==cookies[googleStateCookie]||!code)return redirect(res,'/portal/login?error=Google+login+verification+failed',{'set-cookie':cookie(googleStateCookie,'',{maxAge:0})});
      const profile=await exchangeGoogleCode(code);const user=await findOrBindGoogleCandidate({email:profile.email,sub:profile.sub});
      if(!user)return redirect(res,'/portal/login?error=Your+Google+email+is+not+an+active+candidate+account',{'set-cookie':cookie(googleStateCookie,'',{maxAge:0})});
      const session=createSignedSession(user.id);return redirect(res,user.mustChangePassword?'/portal/change-password':'/portal',{'set-cookie':[cookie(sessionCookie,session.token,{expires:session.expiresAt}),cookie(googleStateCookie,'',{maxAge:0})]});
    }

    const {user}=await identity(req);if(!user)return redirect(res,'/portal/login');
    if(req.method==='POST'&&url.pathname==='/portal/logout')return redirect(res,'/portal/login',{'set-cookie':cookie(sessionCookie,'',{maxAge:0})});

    if(req.method==='GET'&&url.pathname==='/portal/change-password'){
      const body=`<div class="login card"><h1>Change password</h1><div class="notice">${user.mustChangePassword?'Your account is using an administrator-provided password. Set your own password before continuing.':'Set a new password.'}</div><form method="post" action="/portal/change-password"><label>New password<input class="input" type="password" name="password" minlength="8" required autocomplete="new-password"></label><div style="height:12px"></div><label>Confirm password<input class="input" type="password" name="confirm_password" minlength="8" required autocomplete="new-password"></label><div style="height:16px"></div><button class="btn" style="width:100%">Save password</button></form></div>`;
      return send(res,200,layout('Change password',body,user));
    }
    if(req.method==='POST'&&url.pathname==='/portal/change-password'){
      const form=await readForm(req),password=form.get('password')??'',confirm=form.get('confirm_password')??'';
      if(password!==confirm)throw new Error('Passwords do not match.');
      await setCandidatePassword(user.id,password,{mustChange:false});return redirect(res,'/portal');
    }
    if(user.mustChangePassword)return redirect(res,'/portal/change-password');

    if(req.method==='GET'&&url.pathname==='/portal'){
      const [counts,profile,settings,recommendations]=await Promise.all([
        getTrackingCounts(user.id),getPortalCandidateProfile(user.id),getSettings(),getPortalRecommendations(user.id,8),
      ]);
      const usage=await getQuickSearchUsage(user.id,settings.quickSearchDailyLimit,settings.quickSearchAiDailyLimit);
      const aiAvailable=Boolean(settings.aiEnabled&&settings.aiMatchingEnabled&&settings.aiDailyLimit>0&&process.env.AI_BASE_URL&&process.env.AI_MODEL);
      const recommendationRows=recommendations.map((job)=>`<div class="job-row"><div><div class="job-title">${esc(job.title)}</div><div class="job-meta">${esc(job.companyName)}${job.location?` · ${esc(job.location)}`:''}${job.workMode?` · ${esc(job.workMode)}`:''}</div>${job.categories.length?`<div class="chips">${job.categories.map(c=>`<span class="chip">${esc(c)}</span>`).join('')}</div>`:''}<div class="job-reasons">${job.reasons.length?job.reasons.map(esc).join(' · '):'Matched to your profile preferences.'}</div></div><div class="job-actions"><span class="score">${job.score}%</span>${job.applicationUrl?`<a class="btn" href="${esc(job.applicationUrl)}" target="_blank" rel="noreferrer">Apply</a>`:''}${companyActions(job.companyId,job.trackingStatus,'/portal')}</div></div>`).join('');
      const body=`<div class="hero"><div class="micro">Candidate dashboard</div><h1>${esc(profile.name)}</h1><p class="muted">${esc(profile.expertise??'Add your expertise to improve matching')} · ${esc(profile.email)}</p></div>
      <div class="grid dashboard-stats"><div class="card"><div class="micro">Planning</div><div class="metric">${counts.planning}</div></div><div class="card"><div class="micro">Applied</div><div class="metric">${counts.applied}</div></div><div class="card"><div class="micro">Blacklist</div><div class="metric">${counts.excluded}</div></div><div class="card"><div class="micro">Quick searches left</div><div class="metric">${usage.remaining}</div><div class="muted">AI remaining ${usage.aiRemaining}</div></div></div>
      <div class="section"><div class="section-head"><div><div class="micro">Recommendations</div><h2>Best current matches</h2></div><a class="btn secondary" href="/portal/profile">Tune profile</a></div>${recommendationRows?`<div class="job-list">${recommendationRows}</div>`:`<div class="empty">No current jobs meet your match threshold. Run a Quick Search or adjust your profile.</div>`}</div>
      <div class="section quick-panel"><div><div class="micro">On-demand refresh</div><h2>Quick job search</h2><p class="muted">The scheduled crawler runs once per day. Quick Search checks up to ${settings.quickSearchCompanyLimit} relevant companies now, then refreshes your matches.</p><div class="quick-usage">${usage.remaining} standard/total searches remaining today · ${usage.aiRemaining} AI search${usage.aiRemaining===1?'':'es'} remaining</div>${!aiAvailable?'<div class="quick-usage">AI-assisted search is unavailable until AI is enabled and configured.</div>':''}</div><div class="actions"><form method="post" action="/portal/quick-search"><input type="hidden" name="mode" value="STANDARD"><button class="btn" ${usage.remaining<=0?'disabled':''}>Quick Search</button></form><form method="post" action="/portal/quick-search"><input type="hidden" name="mode" value="AI"><button class="btn secondary" ${(usage.remaining<=0||usage.aiRemaining<=0||!aiAvailable)?'disabled':''}>Search with AI</button></form></div></div>
      <div class="section"><div class="section-head"><div><div class="micro">Matching profile</div><h2>Your preferences</h2></div><div class="actions"><a class="btn secondary" href="/portal/companies">Browse companies</a><a class="btn secondary" href="/portal/pipeline">Open pipeline</a></div></div><div class="profile-summary"><div class="kv"><span class="muted">Skills</span><strong>${esc(profile.skills??'Not set')}</strong></div><div class="kv"><span class="muted">Locations</span><strong>${esc(profile.preferredLocations??'Any')}</strong></div><div class="kv"><span class="muted">Preferred categories</span><strong>${esc(profile.preferredCategories??'Not set')}</strong></div><div class="kv"><span class="muted">Excluded categories</span><strong>${esc(profile.excludedCategories??'None')}</strong></div></div></div>`;
      return send(res,200,layout('Candidate home',body,user));
    }

    if(req.method==='GET'&&url.pathname==='/portal/profile'){
      const [profile,categories]=await Promise.all([getPortalCandidateProfile(user.id),listPortalCategoryCatalog()]);
      const preferred=new Set((profile.preferredCategories??'').split(',').map(x=>x.trim()).filter(Boolean));
      const excluded=new Set((profile.excludedCategories??'').split(',').map(x=>x.trim()).filter(Boolean));
      const workModes=new Set((profile.preferredWorkModes??'').split(',').map(x=>x.trim()).filter(Boolean));
      const groups:[string,string][]=[['technology','Technology'],['domain','Domain'],['sector','Sector'],['other','Other categories']];
      const categorySections=groups.map(([type,label])=>{
        const rows=categories.filter(c=>c.type===type);
        if(!rows.length)return '';
        const preferredBoxes=rows.map(c=>`<label class="check"><input type="checkbox" name="preferred_categories" value="${esc(c.name)}" ${preferred.has(c.name)?'checked':''}><span>${esc(c.name)}</span></label>`).join('');
        const excludedBoxes=rows.map(c=>`<label class="check"><input type="checkbox" name="excluded_categories" value="${esc(c.name)}" ${excluded.has(c.name)?'checked':''}><span>${esc(c.name)}</span></label>`).join('');
        return `<div class="subhead">${esc(label)} · preferred</div><div class="checkgrid">${preferredBoxes}</div><div class="subhead">${esc(label)} · excluded</div><div class="checkgrid">${excludedBoxes}</div>`;
      }).join('');
      const experienceOptions=['','Intern','Junior','Mid','Senior','Lead'].map(x=>`<option value="${esc(x)}" ${x.toLowerCase()===(profile.experienceLevel??'').toLowerCase()?'selected':''}>${esc(x||'Not specified')}</option>`).join('');
      const saved=url.searchParams.get('saved')==='1'?'<div class="notice">Profile updated. New matching and Quick Search runs will use these preferences.</div>':'';
      const body=`<div class="actions" style="justify-content:space-between"><div><h1>My profile</h1><p class="muted">Control how jobs and companies are matched to you.</p></div><a class="btn secondary" href="/portal">Back home</a></div>${saved}
      <form class="card" method="post" action="/portal/profile">
        <div class="form-grid">
          <label>Name<input class="input" name="name" maxlength="120" required value="${esc(profile.name)}"></label>
          <label>Email<input class="input" value="${esc(profile.email)}" readonly disabled><span class="muted">Email is managed by the admin because it is also your login identity.</span></label>
          <label>Expertise<input class="input" name="expertise" maxlength="500" placeholder="Backend Engineer, AI Engineer" value="${esc(profile.expertise??'')}"></label>
          <label>Skills<input class="input" name="skills" maxlength="1000" placeholder="Node.js, NestJS, PostgreSQL" value="${esc(profile.skills??'')}"></label>
          <label>Experience level<select class="input" name="experience_level">${experienceOptions}</select></label>
          <label>Minimum match score<input class="input" type="number" name="minimum_match_score" min="0" max="100" value="${profile.minimumMatchScore}"></label>
          <label>Preferred locations<input class="input" name="preferred_locations" maxlength="1000" placeholder="Gulshan, Banani, Remote" value="${esc(profile.preferredLocations??'')}"></label>
          <label>Excluded locations<input class="input" name="excluded_locations" maxlength="1000" placeholder="Uttara, Savar" value="${esc(profile.excludedLocations??'')}"></label>
        </div>
        <div class="section"><h2>Preferred work modes</h2><div class="checkgrid">${['Remote','Hybrid','On-site'].map(mode=>`<label class="check"><input type="checkbox" name="preferred_work_modes" value="${mode}" ${workModes.has(mode)?'checked':''}><span>${mode}</span></label>`).join('')}</div><p class="muted">If a job explicitly states a different work mode, it is rejected. Unknown work mode is not rejected.</p></div>
        <div class="section"><h2>Category preferences</h2><div class="notice">Excluded sectors are hard filters. Excluded technologies/domains reject only jobs that explicitly match them. If a category is selected in both lists, exclusion wins.</div>${categorySections}</div>
        <div class="section actions"><button class="btn">Save profile</button><a class="btn secondary" href="/portal">Cancel</a></div>
      </form>`;
      return send(res,200,layout('My profile',body,user));
    }

    if(req.method==='POST'&&url.pathname==='/portal/profile'){
      const form=await readForm(req);
      await updatePortalCandidateProfile(user.id,{
        name:form.get('name')??'',
        expertise:form.get('expertise')??'',
        skills:form.get('skills')??'',
        experienceLevel:form.get('experience_level')??'',
        preferredLocations:form.get('preferred_locations')??'',
        excludedLocations:form.get('excluded_locations')??'',
        preferredWorkModes:form.getAll('preferred_work_modes'),
        preferredCategories:form.getAll('preferred_categories'),
        excludedCategories:form.getAll('excluded_categories'),
        minimumMatchScore:Number(form.get('minimum_match_score')??'70'),
      });
      return redirect(res,'/portal/profile?saved=1');
    }

    if(req.method==='POST'&&url.pathname==='/portal/quick-search'){
      const form=await readForm(req);const mode=(form.get('mode')??'STANDARD')==='AI'?'AI':'STANDARD';
      const result=await runCandidateQuickSearch(user.id,mode);
      const rows=result.matches.map((m)=>`<tr><td><strong>${esc(m.title)}</strong><div class="muted">${esc(m.companyName)}${m.location?` · ${esc(m.location)}`:''}</div><div class="muted">${m.reasons.map(esc).join(' · ')}</div></td><td><span class="score">${m.score}%</span>${m.aiUsed?'<div class="chip">AI refined</div>':''}</td><td><div class="actions">${m.applicationUrl?`<a class="btn" href="${esc(m.applicationUrl)}" target="_blank" rel="noreferrer">Apply</a>`:''}${companyActions(m.companyId,null,'/portal')}</div></td></tr>`).join('');
      const body=`<div class="actions" style="justify-content:space-between"><div><h1>Quick Search results</h1><div class="muted">${result.mode==='AI'?'AI-assisted':'Standard'} · ${result.companiesChecked} companies checked · ${result.jobsFound} jobs detected · ${result.matches.length} matches</div></div><a class="btn secondary" href="/portal">Back home</a></div>${result.message?`<div class="notice">${esc(result.message)}</div>`:''}<div class="notice">Remaining today: <strong>${result.remaining}</strong> quick searches · AI remaining: <strong>${result.aiRemaining}</strong></div><div class="table-wrap"><table class="table"><thead><tr><th>Job</th><th>Match</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="3">No jobs met your current match threshold.</td></tr>'}</tbody></table></div>`;
      return send(res,200,layout('Quick Search',body,user));
    }

    if(req.method==='GET'&&url.pathname==='/portal/companies'){
      const q=url.searchParams.get('q')??'',category=url.searchParams.get('category')??'';const [rows,categories]=await Promise.all([searchCompaniesForCandidate(user.id,{q,category,limit:75}),listPortalCategories()]);
      const trs=rows.map(c=>`<tr><td><strong>${esc(c.name)}</strong><div class="muted">${esc(c.location??'')}</div><div class="chips">${c.categories.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div></td><td>${trackingPill(c.trackingStatus)}</td><td>${c.careerUrl?`<a href="${esc(c.careerUrl)}" target="_blank" rel="noreferrer">Career page</a>`:c.websiteUrl?`<a href="${esc(c.websiteUrl)}" target="_blank" rel="noreferrer">Website</a>`:'—'}</td><td>${companyActions(c.id,c.trackingStatus)}</td></tr>`).join('');
      const body=`<h1>Companies</h1><form class="toolbar"><div class="field"><label>Search<input class="input" name="q" value="${esc(q)}" placeholder="Company or location"></label></div><div class="field"><label>Category<select name="category"><option value="">All categories</option>${categories.map(x=>`<option value="${esc(x)}" ${x===category?'selected':''}>${esc(x)}</option>`).join('')}</select></label></div><button class="btn">Filter</button></form><div class="table-wrap"><table class="table"><thead><tr><th>Company</th><th>My status</th><th>Link</th><th>Action</th></tr></thead><tbody>${trs||'<tr><td colspan="4">No companies found.</td></tr>'}</tbody></table></div>`;
      return send(res,200,layout('Companies',body,user));
    }

    if(req.method==='GET'&&url.pathname==='/portal/pipeline'){
      const status=url.searchParams.get('status')??'';const rows=await listTrackedCompanies(user.id,status||undefined);
      const trs=rows.map(c=>`<tr><td><strong>${esc(c.name)}</strong><div class="chips">${c.categories.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div></td><td>${trackingPill(c.trackingStatus)}</td><td><form class="inline" method="post" action="/portal/company-state"><input type="hidden" name="company_id" value="${esc(c.id)}"><select name="status"><option ${c.trackingStatus==='PLANNING'?'selected':''}>PLANNING</option><option ${c.trackingStatus==='APPLIED'?'selected':''}>APPLIED</option><option value="EXCLUDED" ${c.trackingStatus==='EXCLUDED'?'selected':''}>BLACKLIST</option></select><input class="input" style="width:145px" type="date" name="last_applied_at" value="${esc(c.lastAppliedAt??'')}"><input class="input" style="width:90px" type="number" min="0" name="reapply_count" value="${c.reapplyCount}" title="Re-apply count"><input class="input" style="min-width:180px" name="notes" value="${esc(c.notes??'')}" placeholder="Notes"><button class="btn">Save</button></form></td><td><form method="post" action="/portal/company-remove"><input type="hidden" name="company_id" value="${esc(c.id)}"><button class="btn secondary">Remove</button></form></td></tr>`).join('');
      const body=`<h1>My company pipeline</h1><div class="toolbar"><a class="btn ${!status?'':'secondary'}" href="/portal/pipeline">All</a><a class="btn secondary" href="/portal/pipeline?status=PLANNING">Planning</a><a class="btn secondary" href="/portal/pipeline?status=APPLIED">Applied</a><a class="btn secondary" href="/portal/pipeline?status=EXCLUDED">Blacklist</a></div><div class="notice">For APPLIED companies, Latest apply date records your most recent application. Re-apply count is the number of applications after the first one.</div><div class="table-wrap"><table class="table"><thead><tr><th>Company</th><th>Status</th><th>Latest apply / reapply / notes</th><th></th></tr></thead><tbody>${trs||'<tr><td colspan="4">Your pipeline is empty.</td></tr>'}</tbody></table></div>`;
      return send(res,200,layout('My pipeline',body,user));
    }

    if(req.method==='POST'&&url.pathname==='/portal/company-state'){
      const form=await readForm(req);const status=form.get('status')??'';if(!['PLANNING','APPLIED','EXCLUDED'].includes(status))throw new Error('Invalid company status.');
      await saveCompanyTracking({candidateId:user.id,companyId:form.get('company_id')??'',status:status as 'PLANNING'|'APPLIED'|'EXCLUDED',lastAppliedAt:form.get('last_applied_at')??'',reapplyCount:Number(form.get('reapply_count')??'0')||0,notes:form.get('notes')??''});
      const returnTo=form.get('return_to')??'';const safeReturn=returnTo.startsWith('/portal')&&!returnTo.startsWith('//')?returnTo:(req.headers.referer?.includes('/portal/pipeline')?'/portal/pipeline':'/portal/companies');return redirect(res,safeReturn);
    }
    if(req.method==='POST'&&url.pathname==='/portal/company-remove'){const form=await readForm(req);await removeCompanyTracking(user.id,form.get('company_id')??'');return redirect(res,'/portal/pipeline');}
    return send(res,404,layout('Not found','<div class="card">Candidate page not found.</div>',user));
  }catch(error){console.error(error);const message=error instanceof Error?error.message:String(error);return send(res,500,layout('Error',`<div class="notice error">${esc(message)}</div>`));}
}
