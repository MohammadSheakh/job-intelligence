import 'dotenv/config';
import { closeDb } from '../src/db.js';
import { renderDigest } from '../src/email/render.js';
import { sendEmail } from '../src/email/smtp.js';
import { findQualifyingMatches, type QualifyingMatch } from '../src/matching/find-matches.js';
import { recordNotification } from '../src/repositories/notifications.js';
import { getSettings } from '../src/repositories/settings.js';

try {
  const settings = await getSettings();
  const found = await findQualifyingMatches();
  const groups = new Map<number, QualifyingMatch[]>();

  for (const match of found.matches) {
    const list = groups.get(match.candidate.id) ?? [];
    list.push(match);
    groups.set(match.candidate.id, list);
  }

  if (!settings.emailEnabled) {
    console.log(
      JSON.stringify(
        {
          emailEnabled: false,
          message: 'Email is disabled in settings; no notifications were sent or recorded.',
          candidateCount: found.candidateCount,
          openJobCount: found.openJobCount,
          qualifyingMatchCount: found.matches.length,
          digestCount: groups.size,
        },
        null,
        2,
      ),
    );
  } else {
    let sentDigests = 0;
    let sentJobNotifications = 0;

    for (const matches of groups.values()) {
      const candidate = matches[0].candidate;
      const digest = renderDigest(candidate.name, matches);
      await sendEmail({ to: candidate.email, ...digest });

      for (const match of matches) {
        await recordNotification(candidate.id, match.job.id, match.result.finalScore);
        sentJobNotifications += 1;
      }
      sentDigests += 1;
      console.log(
        JSON.stringify({ candidateId: candidate.id, email: candidate.email, jobs: matches.length }),
      );
    }

    console.log(JSON.stringify({ summary: { sentDigests, sentJobNotifications } }, null, 2));
  }
} finally {
  await closeDb();
}
