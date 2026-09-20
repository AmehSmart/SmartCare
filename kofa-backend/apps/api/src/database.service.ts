import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../../generated/clinical/client.js';

@Injectable()
export class ClinicalDatabase extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClinicalDatabase.name);

  async onModuleInit(): Promise<void> {
    // Serverless Postgres (e.g. Neon) can be suspended and take a few seconds to
    // wake; the first connection often fails with P1001. Retry with backoff so a
    // cold start does not crash boot.
    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        const delayMs = Math.min(1000 * attempt, 5000);
        this.logger.warn(
          `Database not reachable (attempt ${attempt}/${maxAttempts}); retrying in ${delayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
