import { parseCareerPage } from './career-page.parser.js';
import type { CareerPage } from './types.js';

describe('Pure domain career page parser (career-page.parser.ts)', () => {
  const companyId = '42';
  const requestedUrl = 'https://example.com/careers';
  const finalUrl = 'https://example.com/careers';

  it('extracts jobs and deadlines from standard HTML career pages', () => {
    const html = `
      <html>
        <body>
          <div class="careers-section">
            <h2>Current Openings</h2>
            <div class="job-item">
              <a href="/jobs/backend-engineer">Senior Backend Engineer</a>
              <span class="location">Dhaka, Bangladesh</span>
              <p>Deadline: 2026-12-31</p>
            </div>
            <div class="job-item">
              <a href="/jobs/frontend-developer">Frontend Developer (React)</a>
              <span class="location">Remote</span>
            </div>
          </div>
        </body>
      </html>
    `;

    const page: CareerPage = {
      requestedUrl,
      finalUrl,
      httpStatus: 200,
      html,
    };

    const result = parseCareerPage(companyId, page);

    expect(result.companyId).toBe(companyId);
    expect(result.noOpeningsSignal).toBe(false);
    expect(result.jobs.length).toBeGreaterThanOrEqual(1);
    expect(result.pageHash).toMatch(/^[a-f0-9]{64}$/);

    const backendJob = result.jobs.find((j) => /backend/i.test(j.title));
    expect(backendJob).toBeDefined();
    expect(backendJob?.applicationUrl).toContain('https://example.com/jobs/backend-engineer');
    expect(backendJob?.deadline).toBeInstanceOf(Date);
    expect(backendJob?.deadline?.toISOString()).toContain('2026-12-31');
  });

  it('detects explicit "no current openings" signal and returns empty jobs list', () => {
    const html = `
      <html>
        <body>
          <h1>Careers</h1>
          <p>Thank you for your interest. Currently no openings are available at this time.</p>
        </body>
      </html>
    `;

    const page: CareerPage = {
      requestedUrl,
      finalUrl,
      httpStatus: 200,
      html,
    };

    const result = parseCareerPage(companyId, page);

    expect(result.noOpeningsSignal).toBe(true);
    expect(result.jobs).toEqual([]);
  });

  it('throws an error if HTTP status is not 2xx', () => {
    const page: CareerPage = {
      requestedUrl,
      finalUrl,
      httpStatus: 404,
      html: '<html><body>Not found</body></html>',
    };

    expect(() => parseCareerPage(companyId, page)).toThrow('HTTP 404');
  });

  it('throws an error if HTML size exceeds the 2 MiB safety limit', () => {
    const hugeHtml = 'x'.repeat(2 * 1024 * 1024 + 10);
    const page: CareerPage = {
      requestedUrl,
      finalUrl,
      httpStatus: 200,
      html: hugeHtml,
    };

    expect(() => parseCareerPage(companyId, page)).toThrow(/2 MiB parsing limit/);
  });
});
