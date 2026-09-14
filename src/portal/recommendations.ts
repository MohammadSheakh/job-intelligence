import { deterministicMatch } from '../matching/matcher.js';
import { getActiveCandidateById } from '../repositories/candidates.js';
import { getOpenJobsForMatching } from '../repositories/jobs.js';
import { getCandidateCompanyStateMap } from './repository.js';

export interface PortalRecommendation {
  jobId:number;
  companyId:string;
  companyName:string;
  title:string;
  location:string|null;
  workMode:string|null;
  applicationUrl:string|null;
  score:number;
  reasons:string[];
  categories:string[];
  trackingStatus:'PLANNING'|'APPLIED'|'EXCLUDED'|null;
}

export async function getPortalRecommendations(candidateId:number, limit=8):Promise<PortalRecommendation[]> {
  const [candidate,jobs,stateMap]=await Promise.all([
    getActiveCandidateById(candidateId),
    getOpenJobsForMatching(),
    getCandidateCompanyStateMap(candidateId),
  ]);
  if(!candidate) return [];
  const threshold=candidate.minimumMatchScore??70;
  const rows:PortalRecommendation[]=[];
  for(const job of jobs){
    const state=stateMap.get(job.companyId)??null;
    if(state==='EXCLUDED') continue;
    const result=deterministicMatch(candidate,job);
    if(!result.eligible||result.finalScore<threshold) continue;
    rows.push({
      jobId:job.id,companyId:job.companyId,companyName:job.companyName,title:job.title,
      location:job.location??job.companyLocation??null,workMode:job.workMode,
      applicationUrl:job.applicationUrl??job.companyCareerUrl??job.companyWebsiteUrl,
      score:result.finalScore,reasons:result.reasons.slice(0,3),categories:job.companyCategories.slice(0,5),trackingStatus:state,
    });
  }
  return rows.sort((a,b)=>b.score-a.score||b.jobId-a.jobId).slice(0,Math.max(1,Math.min(20,limit)));
}
