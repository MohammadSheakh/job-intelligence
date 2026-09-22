import { EmailRenderService } from './email-render.service.js';
import type { CandidateNotificationTarget, DigestMatch } from '../domain/types.js';

describe('EmailRenderService (pure unit test)', () => {
  let service: EmailRenderService;

  const mockCandidate: CandidateNotificationTarget = {
    id: 10n,
    name: 'Candidate <Name>',
    email: 'candidate@example.test',
    minimumMatchScore: 60,
  };

  beforeEach(() => {
    service = new EmailRenderService();
  });

  it('renders digest and escapes untrusted HTML characters in names and titles', () => {
    const matches: DigestMatch[] = [
      {
        candidate: mockCandidate,
        threshold: 60,
        job: {
          id: 1n,
          title: '<script>alert("xss")</script> Backend Lead',
          companyName: 'Acme & Co <test>',
          location: 'Dhaka',
          workMode: 'remote',
          applicationUrl: 'https://example.com/apply',
          companyWebsiteUrl: 'https://example.com',
        },
        result: {
          eligible: true,
          deterministicScore: 92,
          finalScore: 92,
          breakdown: {},
          matchedSkills: ['Node.js', '<SQL>'],
          matchedCompanyCategories: ['Fintech'],
          matchedPreferredCategories: ['Backend'],
          reasons: ['Preferred location matched'],
          aiUsed: false,
        },
      },
    ];

    const rendered = service.renderDigest(mockCandidate.name, matches);

    expect(rendered.subject).toBe('1 new job match for you');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).toContain('Acme &amp; Co &lt;test&gt;');
    expect(rendered.html).toContain('&lt;SQL&gt;');
    expect(rendered.html).toContain('Candidate &lt;Name&gt;');
  });

  it('filters unsafe URLs so malicious protocols do not become clickable links', () => {
    const matches: DigestMatch[] = [
      {
        candidate: mockCandidate,
        threshold: 60,
        job: {
          id: 2n,
          title: 'Security Analyst',
          companyName: 'CyberCorp',
          applicationUrl: 'javascript:alert(1)',
          companyWebsiteUrl: 'data:text/html,bad',
        },
        result: {
          eligible: true,
          deterministicScore: 85,
          finalScore: 85,
          breakdown: {},
          matchedSkills: [],
          matchedCompanyCategories: [],
          matchedPreferredCategories: [],
          reasons: [],
          aiUsed: false,
        },
      },
    ];

    const rendered = service.renderDigest('Bob', matches);

    expect(rendered.html).not.toContain('href="javascript:');
    expect(rendered.html).not.toContain('href="data:');
  });

  it('sorts multiple job matches by finalScore descending', () => {
    const matches: DigestMatch[] = [
      {
        candidate: mockCandidate,
        threshold: 60,
        job: { id: 10n, title: 'Job Low Score', companyName: 'Corp A' },
        result: {
          eligible: true,
          deterministicScore: 65,
          finalScore: 65,
          breakdown: {},
          matchedSkills: [],
          matchedCompanyCategories: [],
          matchedPreferredCategories: [],
          reasons: [],
          aiUsed: false,
        },
      },
      {
        candidate: mockCandidate,
        threshold: 60,
        job: { id: 20n, title: 'Job High Score', companyName: 'Corp B' },
        result: {
          eligible: true,
          deterministicScore: 95,
          finalScore: 95,
          breakdown: {},
          matchedSkills: [],
          matchedCompanyCategories: [],
          matchedPreferredCategories: [],
          reasons: [],
          aiUsed: false,
        },
      },
    ];

    const rendered = service.renderDigest('Alice', matches);

    expect(rendered.subject).toBe('2 new job matches for you');
    const indexHigh = rendered.text.indexOf('Job High Score');
    const indexLow = rendered.text.indexOf('Job Low Score');
    expect(indexHigh).toBeLessThan(indexLow);
  });
});
