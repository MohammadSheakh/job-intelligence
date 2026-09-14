const CAREER_URL_OVERRIDES: Record<string, string> = {
  // Legacy /position.php now returns 404; current openings are listed here.
  C0019: 'https://genexinfosys.com/career',
  // Current Incrosoft site exposes Careers at /careers.
  C0027: 'https://incrosoft.com/careers',
};

export function resolveCareerUrl(companyId: string, storedUrl: string): string {
  return CAREER_URL_OVERRIDES[companyId] ?? storedUrl;
}
