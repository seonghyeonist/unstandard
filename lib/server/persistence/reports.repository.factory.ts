import "server-only";

import { isReportsPersistenceEnabled } from "@/lib/config/persistence-mode";
import type { ReportsRepository } from "@/lib/server/persistence/reports.repository.interface";
import type { CreateReportInput, CreateReportResult } from "@/lib/server/persistence/reports.types";
import { reportFailure } from "@/lib/server/persistence/reports.types";
import { createDrizzleReportsRepository } from "@/lib/db/repositories/reports.repository";

const persistenceDisabledRepository: ReportsRepository = {
  async createOrGetOpenReport(): Promise<CreateReportResult> {
    return reportFailure("PERSISTENCE_DISABLED");
  },
};

export function createReportsRepository(): ReportsRepository {
  if (!isReportsPersistenceEnabled()) {
    return persistenceDisabledRepository;
  }
  return createDrizzleReportsRepository();
}

export type { CreateReportInput, CreateReportResult };
