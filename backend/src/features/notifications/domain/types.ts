import type { CandidateForMatch, JobForMatch, MatchResult } from '../../matching/domain/types.js';

export interface CandidateNotificationTarget extends CandidateForMatch {
  id: bigint;
  name: string;
  email: string;
  minimumMatchScore?: number | null;
}

export interface JobNotificationTarget extends JobForMatch {
  id: bigint;
  companyName: string;
  companyWebsiteUrl?: string | null;
  applicationUrl?: string | null;
}

export interface DigestMatch {
  candidate: CandidateNotificationTarget;
  job: JobNotificationTarget;
  threshold: number;
  result: MatchResult;
}

export interface DigestEmailContent {
  subject: string;
  text: string;
  html: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface NotificationRecord {
  candidateId: bigint;
  jobId: bigint;
  matchScore: number;
}

export interface DailyNotificationSummary {
  emailEnabled: boolean;
  candidateCount: number;
  openJobCount: number;
  qualifyingMatchCount: number;
  digestCount: number;
  sentDigests: number;
  sentJobNotifications: number;
  failedDigests: number;
  message?: string;
}
