import { db } from '../db.js';

export interface PortalCompanyRow {
  id:string; name:string; websiteUrl:string|null; careerUrl:string|null; location:string|null;
  categories:string[]; trackingStatus:'PLANNING'|'APPLIED'|'EXCLUDED'|null;
  lastAppliedAt:string|null; reapplyCount:number; notes:string|null;
}

let trackingTableCache: boolean | null = null;
async function trackingTableExists(): Promise<boolean> {
  if (trackingTableCache !== null) return trackingTableCache;
  const result = await db.query<{ exists:boolean }>(`SELECT to_regclass('public.candidate_company_state') IS NOT NULL AS exists`);
  trackingTableCache = Boolean(result.rows[0]?.exists);
  return trackingTableCache;
}


export async function getCandidateCompanyStateMap(candidateId:number): Promise<Map<string,'PLANNING'|'APPLIED'|'EXCLUDED'>> {
  if (!await trackingTableExists()) return new Map();
  const result=await db.query<{company_id:string;status:'PLANNING'|'APPLIED'|'EXCLUDED'}>(`
    SELECT company_id,status FROM candidate_company_state WHERE candidate_id=$1
  `,[candidateId]);
  return new Map(result.rows.map(row=>[row.company_id,row.status]));
}

export async function getTrackingCounts(candidateId:number): Promise<{ planning:number; applied:number; excluded:number }> {
  if (!await trackingTableExists()) return { planning:0, applied:0, excluded:0 };
  const result = await db.query<{ status:string; count:string }>(`
    SELECT status,count(*)::text FROM candidate_company_state WHERE candidate_id=$1 GROUP BY status
  `,[candidateId]);
  const counts={ planning:0, applied:0, excluded:0 };
  for(const row of result.rows){
    if(row.status==='PLANNING') counts.planning=Number(row.count);
    if(row.status==='APPLIED') counts.applied=Number(row.count);
    if(row.status==='EXCLUDED') counts.excluded=Number(row.count);
  }
  return counts;
}

export async function searchCompaniesForCandidate(candidateId:number,input:{q?:string;category?:string;limit?:number}):Promise<PortalCompanyRow[]> {
  const hasTracking = await trackingTableExists();
  const params:unknown[]=[];
  const where=['c.active=true'];
  if(input.q?.trim()){
    params.push(`%${input.q.trim()}%`);
    where.push(`(c.name ILIKE $${params.length} OR COALESCE(c.location,'') ILIKE $${params.length} OR COALESCE(c.tech_stack,'') ILIKE $${params.length})`);
  }
  if(input.category?.trim()){
    params.push(input.category.trim());
    where.push(`EXISTS(SELECT 1 FROM company_categories ccx JOIN categories cx ON cx.id=ccx.category_id WHERE ccx.company_id=c.id AND cx.name=$${params.length})`);
  }
  let trackingJoin = '';
  let trackingSelect = `NULL::text AS status,NULL::text AS last_applied_at,NULL::integer AS reapply_count,NULL::text AS notes`;
  if(hasTracking){
    params.push(candidateId);
    trackingJoin=`LEFT JOIN candidate_company_state t ON t.company_id=c.id AND t.candidate_id=$${params.length}`;
    trackingSelect=`t.status,t.last_applied_at::text,t.reapply_count,t.notes`;
  }
  params.push(Math.max(1,Math.min(100,input.limit??50)));
  const result=await db.query<{
    id:string;name:string;website_url:string|null;career_url:string|null;location:string|null;categories:string[]|null;
    status:'PLANNING'|'APPLIED'|'EXCLUDED'|null;last_applied_at:string|null;reapply_count:number|null;notes:string|null;
  }>(`
    SELECT c.id,c.name,c.website_url,c.career_url,c.location,
      COALESCE((SELECT array_agg(cat.name ORDER BY cat.name) FROM company_categories cc JOIN categories cat ON cat.id=cc.category_id WHERE cc.company_id=c.id AND cat.name<>'Other'),ARRAY[]::text[]) AS categories,
      ${trackingSelect}
    FROM companies c
    ${trackingJoin}
    WHERE ${where.join(' AND ')}
    ORDER BY c.name
    LIMIT $${params.length}
  `,params);
  return result.rows.map(r=>({
    id:r.id,name:r.name,websiteUrl:r.website_url,careerUrl:r.career_url,location:r.location,categories:r.categories??[],
    trackingStatus:r.status,lastAppliedAt:r.last_applied_at,reapplyCount:Number(r.reapply_count??0),notes:r.notes,
  }));
}

export async function listTrackedCompanies(candidateId:number,status?:string):Promise<PortalCompanyRow[]> {
  if (!await trackingTableExists()) return [];
  const params:unknown[]=[candidateId];
  let statusSql='';
  if(status){params.push(status);statusSql=`AND t.status=$2`;}
  const result=await db.query<{
    id:string;name:string;website_url:string|null;career_url:string|null;location:string|null;categories:string[]|null;
    status:'PLANNING'|'APPLIED'|'EXCLUDED';last_applied_at:string|null;reapply_count:number;notes:string|null;
  }>(`
    SELECT c.id,c.name,c.website_url,c.career_url,c.location,
      COALESCE((SELECT array_agg(cat.name ORDER BY cat.name) FROM company_categories cc JOIN categories cat ON cat.id=cc.category_id WHERE cc.company_id=c.id AND cat.name<>'Other'),ARRAY[]::text[]) AS categories,
      t.status,t.last_applied_at::text,t.reapply_count,t.notes
    FROM candidate_company_state t JOIN companies c ON c.id=t.company_id
    WHERE t.candidate_id=$1 ${statusSql}
    ORDER BY CASE t.status WHEN 'PLANNING' THEN 1 WHEN 'APPLIED' THEN 2 ELSE 3 END,t.updated_at DESC,c.name
  `,params);
  return result.rows.map(r=>({id:r.id,name:r.name,websiteUrl:r.website_url,careerUrl:r.career_url,location:r.location,categories:r.categories??[],trackingStatus:r.status,lastAppliedAt:r.last_applied_at,reapplyCount:Number(r.reapply_count),notes:r.notes}));
}

export async function saveCompanyTracking(input:{candidateId:number;companyId:string;status:'PLANNING'|'APPLIED'|'EXCLUDED';lastAppliedAt?:string;reapplyCount?:number;notes?:string}):Promise<void>{
  if (!await trackingTableExists()) throw new Error('Company pipeline storage is not migrated yet. Run sql/006_candidate_portal.sql.');
  const reapply=Math.max(0,Math.min(999,Math.floor(input.reapplyCount??0)));
  const lastApplied=(input.lastAppliedAt??'').trim() || null;
  await db.query(`
    INSERT INTO candidate_company_state(candidate_id,company_id,status,last_applied_at,reapply_count,notes,updated_at)
    VALUES($1,$2,$3,CASE WHEN $3='APPLIED' THEN COALESCE($4::date,CURRENT_DATE) ELSE $4::date END,$5,NULLIF($6,''),now())
    ON CONFLICT(candidate_id,company_id) DO UPDATE SET
      status=EXCLUDED.status,
      last_applied_at=COALESCE(EXCLUDED.last_applied_at,candidate_company_state.last_applied_at),
      reapply_count=EXCLUDED.reapply_count,
      notes=EXCLUDED.notes,
      updated_at=now()
  `,[input.candidateId,input.companyId,input.status,lastApplied,reapply,input.notes?.trim()??'']);
}

export async function removeCompanyTracking(candidateId:number,companyId:string):Promise<void>{
  if (!await trackingTableExists()) return;
  await db.query('DELETE FROM candidate_company_state WHERE candidate_id=$1 AND company_id=$2',[candidateId,companyId]);
}

export interface PortalCandidateProfile {
  name:string;
  email:string;
  expertise:string|null;
  skills:string|null;
  experienceLevel:string|null;
  preferredLocations:string|null;
  excludedLocations:string|null;
  preferredWorkModes:string|null;
  preferredCategories:string|null;
  excludedCategories:string|null;
  minimumMatchScore:number;
}

export interface PortalCategory {
  name:string;
  type:'technology'|'domain'|'sector'|'other';
}

export async function getPortalCandidateProfile(candidateId:number):Promise<PortalCandidateProfile> {
  const result=await db.query<{
    name:string;email:string;expertise:string|null;skills:string|null;experience_level:string|null;
    preferred_locations:string|null;excluded_locations:string|null;preferred_work_modes:string|null;
    preferred_categories:string|null;excluded_categories:string|null;minimum_match_score:number;
  }>(`
    SELECT name,email,expertise,skills,experience_level,preferred_locations,excluded_locations,
           preferred_work_modes,preferred_categories,excluded_categories,minimum_match_score
    FROM candidates WHERE id=$1 AND active=true
  `,[candidateId]);
  const row=result.rows[0];
  if(!row) throw new Error('Candidate profile not found.');
  return {
    name:row.name,email:row.email,expertise:row.expertise,skills:row.skills,experienceLevel:row.experience_level,
    preferredLocations:row.preferred_locations,excludedLocations:row.excluded_locations,preferredWorkModes:row.preferred_work_modes,
    preferredCategories:row.preferred_categories,excludedCategories:row.excluded_categories,minimumMatchScore:row.minimum_match_score,
  };
}

export async function listPortalCategoryCatalog():Promise<PortalCategory[]> {
  const result=await db.query<PortalCategory>(`SELECT name,type FROM categories WHERE name<>'Other' ORDER BY type,name`);
  return result.rows;
}

export async function listPortalCategories():Promise<string[]> {
  return (await listPortalCategoryCatalog()).map(r=>r.name);
}

function cleanText(value:string|undefined,max:number):string|null {
  const text=(value??'').trim().replace(/\s+/g,' ');
  return text ? text.slice(0,max) : null;
}

export async function updatePortalCandidateProfile(candidateId:number,input:{
  name:string;
  expertise?:string;
  skills?:string;
  experienceLevel?:string;
  preferredLocations?:string;
  excludedLocations?:string;
  preferredWorkModes?:string[];
  preferredCategories?:string[];
  excludedCategories?:string[];
  minimumMatchScore:number;
}):Promise<void>{
  const name=cleanText(input.name,120);
  if(!name) throw new Error('Name is required.');

  const threshold=Math.floor(input.minimumMatchScore);
  if(!Number.isFinite(threshold)||threshold<0||threshold>100) throw new Error('Match threshold must be between 0 and 100.');

  const allowedModes=new Set(['Remote','Hybrid','On-site']);
  const workModes=[...new Set((input.preferredWorkModes??[]).filter(x=>allowedModes.has(x)))];

  const catalog=await listPortalCategoryCatalog();
  const allowedCategories=new Set(catalog.map(c=>c.name));
  const excluded=[...new Set((input.excludedCategories??[]).filter(x=>allowedCategories.has(x)))];
  const excludedSet=new Set(excluded);
  const preferred=[...new Set((input.preferredCategories??[]).filter(x=>allowedCategories.has(x)&&!excludedSet.has(x)))];

  const result=await db.query(`
    UPDATE candidates SET
      name=$2,
      expertise=$3,
      skills=$4,
      experience_level=$5,
      preferred_locations=$6,
      excluded_locations=$7,
      preferred_work_modes=$8,
      preferred_categories=$9,
      excluded_categories=$10,
      minimum_match_score=$11,
      updated_at=now()
    WHERE id=$1 AND active=true
  `,[
    candidateId,name,
    cleanText(input.expertise,500),cleanText(input.skills,1000),cleanText(input.experienceLevel,80),
    cleanText(input.preferredLocations,1000),cleanText(input.excludedLocations,1000),
    workModes.length?workModes.join(', '):null,
    preferred.length?preferred.join(', '):null,
    excluded.length?excluded.join(', '):null,
    threshold,
  ]);
  if(result.rowCount!==1) throw new Error('Candidate profile not found.');
}
