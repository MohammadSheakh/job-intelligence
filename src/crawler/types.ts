export interface CompanyForCrawl {
  id: string;
  name: string;
  careerUrl: string;
}

export interface CrawledJob {
  companyId: string;
  title: string;
  location?: string;
  applicationUrl: string;
  description?: string;
  sourceUrl?: string;
}

export interface CrawlResult {
  companyId: string;
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  pageHash: string;
  noOpeningsSignal: boolean;
  jobs: CrawledJob[];
}
