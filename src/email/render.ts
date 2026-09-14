import type { CandidateForMatch, JobForMatch, MatchResult } from '../matching/types.js';

export interface DigestMatch {
  candidate: CandidateForMatch;
  job: JobForMatch;
  threshold: number;
  result: MatchResult;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function renderDigest(candidateName: string, matches: DigestMatch[]): { subject: string; text: string; html: string } {
  const sorted = [...matches].sort((a, b) => b.result.finalScore - a.result.finalScore);
  const subject = `${sorted.length} new job match${sorted.length === 1 ? '' : 'es'} for you`;

  const textJobs = sorted.map(({ job, result }, index) => {
    const lines = [
      `${index + 1}. ${job.title} — ${job.companyName}`,
      `Match: ${result.finalScore}%`,
      job.location || job.companyLocation ? `Location: ${job.location ?? job.companyLocation}` : null,
      job.workMode ? `Work mode: ${job.workMode}` : null,
      result.matchedSkills.length ? `Matched skills: ${result.matchedSkills.join(', ')}` : null,
      result.matchedCompanyCategories.length ? `Company context: ${result.matchedCompanyCategories.join(', ')}` : null,
      result.matchedPreferredCategories.length ? `Preferred categories: ${result.matchedPreferredCategories.join(', ')}` : null,
      result.reasons.length ? `Why: ${result.reasons.join('; ')}` : null,
      job.applicationUrl ? `Apply: ${job.applicationUrl}` : null,
      job.companyWebsiteUrl ? `Company: ${job.companyWebsiteUrl}` : null,
    ].filter(Boolean);
    return lines.join('\n');
  }).join('\n\n');

  const cards = sorted.map(({ job, result }) => {
    const apply = safeUrl(job.applicationUrl);
    const company = safeUrl(job.companyWebsiteUrl);
    return `
      <div style="border:1px solid #ddd;border-radius:8px;padding:16px;margin:0 0 16px">
        <h2 style="margin:0 0 8px;font-size:18px">${escapeHtml(job.title)}</h2>
        <div><strong>${escapeHtml(job.companyName)}</strong> · ${result.finalScore}% match</div>
        ${job.location || job.companyLocation ? `<div>Location: ${escapeHtml(job.location ?? job.companyLocation ?? '')}</div>` : ''}
        ${job.workMode ? `<div>Work mode: ${escapeHtml(job.workMode)}</div>` : ''}
        ${result.matchedSkills.length ? `<div>Matched skills: ${escapeHtml(result.matchedSkills.join(', '))}</div>` : ''}
        ${result.matchedCompanyCategories.length ? `<div>Company context: ${escapeHtml(result.matchedCompanyCategories.join(', '))}</div>` : ''}
        ${result.matchedPreferredCategories.length ? `<div>Preferred categories: ${escapeHtml(result.matchedPreferredCategories.join(', '))}</div>` : ''}
        ${result.reasons.length ? `<div style="margin-top:8px">Why: ${escapeHtml(result.reasons.join('; '))}</div>` : ''}
        <div style="margin-top:12px">
          ${apply ? `<a href="${escapeHtml(apply)}">Apply</a>` : ''}
          ${company ? `${apply ? ' · ' : ''}<a href="${escapeHtml(company)}">Company website</a>` : ''}
        </div>
      </div>`;
  }).join('');

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
    <p>Hi ${escapeHtml(candidateName)},</p>
    <p>We found ${sorted.length} new job match${sorted.length === 1 ? '' : 'es'} for your profile.</p>
    ${cards}
    <p>This digest only includes jobs above your configured match threshold.</p>
  </body></html>`;

  return {
    subject,
    text: `Hi ${candidateName},\n\nWe found ${sorted.length} new job match${sorted.length === 1 ? '' : 'es'} for your profile.\n\n${textJobs}`,
    html,
  };
}
