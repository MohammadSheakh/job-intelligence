import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/database';
import type { NotificationRecord } from '../domain/types.js';

/**
 * Manages notification delivery history to prevent duplicate job emails to the same candidate.
 */
@Injectable()
export class NotificationDeduplicationService {
  private readonly logger = new Logger(NotificationDeduplicationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a set of candidateId:jobId strings that have already been emailed.
   */
  async getNotifiedPairSet(): Promise<Set<string>> {
    const rows = await this.prisma.notification.findMany({
      select: {
        candidate_id: true,
        job_id: true,
      },
    });

    return new Set(rows.map((row) => `${row.candidate_id}:${row.job_id}`));
  }

  /**
   * Atomically record job notification delivery for candidates.
   * Duplicate records are ignored via unique constraint on (candidate_id, job_id).
   */
  async recordNotifications(records: NotificationRecord[]): Promise<void> {
    if (records.length === 0) return;

    try {
      await this.prisma.notification.createMany({
        data: records.map((rec) => ({
          candidate_id: rec.candidateId,
          job_id: rec.jobId,
          match_score: rec.matchScore,
          sent_at: new Date(),
        })),
        skipDuplicates: true,
      });
      this.logger.log(`Recorded ${records.length} notification delivery entries.`);
    } catch (error) {
      this.logger.error({
        message: 'Failed to record notification deliveries in database.',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
