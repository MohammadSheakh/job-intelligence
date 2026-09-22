import { Injectable } from '@nestjs/common';
import type { DigestEmailContent, DigestMatch } from '../domain/types.js';

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

/**
 * Pure rendering service producing plain text and responsive HTML candidate digests.
 * Research URLs are untrusted data; only verified http(s) links become clickable anchors.
 */
@Injectable()
export class EmailRenderService {
  renderDigest(candidateName: string, matches: DigestMatch[]): DigestEmailContent {
    const sorted = [...matches].sort((a, b) => b.result.finalScore - a.result.finalScore);
    const count = sorted.length;
    const subject = `${count} new job match${count === 1 ? '' : 'es'} for you`;

    const textJobs = sorted
      .map(({ job, result }, index) => {
        const lines = [
          `${index + 1}. ${job.title} — ${job.companyName}`,
          `Match: ${result.finalScore}%`,
          job.location || job.companyLocation
            ? `Location: ${job.location ?? job.companyLocation}`
            : null,
          job.workMode ? `Work mode: ${job.workMode}` : null,
          result.matchedSkills.length ? `Matched skills: ${result.matchedSkills.join(', ')}` : null,
          result.matchedCompanyCategories.length
            ? `Company context: ${result.matchedCompanyCategories.join(', ')}`
            : null,
          result.matchedPreferredCategories.length
            ? `Preferred categories: ${result.matchedPreferredCategories.join(', ')}`
            : null,
          result.reasons.length ? `Why: ${result.reasons.join('; ')}` : null,
          job.applicationUrl ? `Apply: ${job.applicationUrl}` : null,
          job.companyWebsiteUrl ? `Company: ${job.companyWebsiteUrl}` : null,
        ].filter(Boolean);
        return lines.join('\n');
      })
      .join('\n\n');

    const cards = sorted
      .map(({ job, result }) => {
        const apply = safeUrl(job.applicationUrl);
        const company = safeUrl(job.companyWebsiteUrl);
        return `
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 16px;background:#ffffff">
        <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#0f172a">${escapeHtml(job.title)}</h2>
        <div style="color:#334155;font-size:14px;margin-bottom:8px">
          <strong style="color:#0f172a">${escapeHtml(job.companyName)}</strong> · <span style="font-weight:600;color:#047857">${result.finalScore}% match</span>
        </div>
        ${job.location || job.companyLocation ? `<div style="font-size:13px;color:#475569">Location: ${escapeHtml(job.location ?? job.companyLocation ?? '')}</div>` : ''}
        ${job.workMode ? `<div style="font-size:13px;color:#475569">Work mode: ${escapeHtml(job.workMode)}</div>` : ''}
        ${result.matchedSkills.length ? `<div style="font-size:13px;color:#475569;margin-top:4px">Matched skills: ${escapeHtml(result.matchedSkills.join(', '))}</div>` : ''}
        ${result.matchedCompanyCategories.length ? `<div style="font-size:13px;color:#475569">Company context: ${escapeHtml(result.matchedCompanyCategories.join(', '))}</div>` : ''}
        ${result.matchedPreferredCategories.length ? `<div style="font-size:13px;color:#475569">Preferred categories: ${escapeHtml(result.matchedPreferredCategories.join(', '))}</div>` : ''}
        ${result.reasons.length ? `<div style="font-size:13px;color:#64748b;margin-top:8px">Why: ${escapeHtml(result.reasons.join('; '))}</div>` : ''}
        <div style="margin-top:14px;font-size:14px">
          ${apply ? `<a href="${escapeHtml(apply)}" target="_blank" rel="noopener noreferrer" style="color:#0f172a;font-weight:600;text-decoration:underline">Apply ↗</a>` : ''}
          ${company ? `${apply ? ' · ' : ''}<a href="${escapeHtml(company)}" target="_blank" rel="noopener noreferrer" style="color:#475569;text-decoration:underline">Company website ↗</a>` : ''}
        </div>
      </div>`;
      })
      .join('');

    const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#0f172a;background:#f8fafc;padding:24px 16px;margin:0">
    <div style="max-width:600px;margin:0 auto">
      <p style="font-size:16px">Hi ${escapeHtml(candidateName)},</p>
      <p style="font-size:15px;color:#334155">We found ${count} new job match${count === 1 ? '' : 'es'} for your profile above your configured threshold.</p>
      ${cards}
      <p style="font-size:13px;color:#64748b;margin-top:24px">This digest only includes newly discovered vacancies matching your target criteria. You will not receive repeated emails for the same job.</p>
    </div>
  </body></html>`;

    return {
      subject,
      text: `Hi ${candidateName},\n\nWe found ${count} new job match${count === 1 ? '' : 'es'} for your profile.\n\n${textJobs}`,
      html,
    };
  }
}
