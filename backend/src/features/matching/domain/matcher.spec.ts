import { deterministicMatch } from './matcher.js';
import type { CandidateForMatch, JobForMatch } from './types.js';

describe('Pure domain matcher (matcher.ts)', () => {
  const baseCandidate: CandidateForMatch = {
    skills: 'TypeScript, Node.js, PostgreSQL, Docker',
    experienceLevel: 'Mid',
    experienceYears: 4,
    preferredLocations: 'Dhaka, Remote',
    preferredWorkModes: 'remote, hybrid',
    preferredCategories: 'Backend, Fintech',
  };

  const baseJob: JobForMatch = {
    title: 'Senior Node.js Backend Engineer',
    description: 'We require 3+ years of experience with Node.js, TypeScript, and PostgreSQL.',
    location: 'Dhaka',
    workMode: 'remote',
    companyCategories: ['Backend', 'Fintech'],
    companySectorCategories: ['Fintech'],
  };

  it('calculates high match score for aligned candidate and job', () => {
    const result = deterministicMatch(baseCandidate, baseJob);

    expect(result.eligible).toBe(true);
    expect(result.deterministicScore).toBeGreaterThanOrEqual(70);
    expect(result.matchedSkills).toContain('typescript');
    expect(result.matchedSkills).toContain('nodejs');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.breakdown.location).toBe(100);
    expect(result.breakdown.workMode).toBe(100);
  });

  it('rejects candidate if location matches an explicit excluded location', () => {
    const candidate: CandidateForMatch = {
      ...baseCandidate,
      excludedLocations: 'Sylhet',
    };
    const job: JobForMatch = {
      ...baseJob,
      location: 'Sylhet',
    };

    const result = deterministicMatch(candidate, job);
    expect(result.eligible).toBe(false);
    expect(result.rejectionReason).toMatch(/excluded location/i);
    expect(result.finalScore).toBe(0);
  });

  it('awards partial score (35) when job location is not preferred but not excluded', () => {
    const candidate: CandidateForMatch = {
      ...baseCandidate,
      preferredLocations: 'Chittagong',
    };
    const job: JobForMatch = {
      ...baseJob,
      location: 'Sylhet',
    };

    const result = deterministicMatch(candidate, job);
    expect(result.eligible).toBe(true);
    expect(result.breakdown.location).toBe(35);
  });

  it('rejects candidate if work mode is strictly excluded', () => {
    const candidate: CandidateForMatch = {
      ...baseCandidate,
      preferredWorkModes: 'remote',
    };
    const job: JobForMatch = {
      ...baseJob,
      workMode: 'onsite',
    };

    const result = deterministicMatch(candidate, job);
    expect(result.eligible).toBe(false);
    expect(result.rejectionReason).toMatch(/work mode/i);
  });

  it('rejects candidate if company category is in candidate excludedCategories', () => {
    const candidate: CandidateForMatch = {
      ...baseCandidate,
      excludedCategories: 'Backend',
    };

    const result = deterministicMatch(candidate, baseJob);
    expect(result.eligible).toBe(false);
    expect(result.rejectionReason).toMatch(/category/i);
  });

  it('accurately parses numeric years from job requirements', () => {
    const juniorCandidate: CandidateForMatch = {
      ...baseCandidate,
      experienceLevel: 'Fresher/Entry',
      experienceYears: 1,
    };
    const seniorJob: JobForMatch = {
      ...baseJob,
      description: 'Minimum 7+ years of experience in distributed systems required.',
    };

    const result = deterministicMatch(juniorCandidate, seniorJob);
    expect(result.eligible).toBe(true);
    expect(result.breakdown.experience).toBeLessThan(50);
  });

  it('produces identical deterministic scores across multiple invocations', () => {
    const res1 = deterministicMatch(baseCandidate, baseJob);
    const res2 = deterministicMatch(baseCandidate, baseJob);

    expect(res1.deterministicScore).toBe(res2.deterministicScore);
    expect(res1.breakdown).toEqual(res2.breakdown);
    expect(res1.reasons).toEqual(res2.reasons);
  });
});
