# Matching

`domain/` contains the legacy deterministic scoring policy without framework or
persistence dependencies. `MatchingModule` exports `CandidateRecommendationsService`
for candidate portal reads. Jobs are scanned in batches, with blacklists filtered
before scoring and bounded top-result retention. No AI or crawling runs here.

See `docs/BACKEND_DEVELOPER_GUIDE.md` for ranking, concurrency, and scaling limits.
Optional AI enhancement and scheduled notification matching remain to be migrated.
