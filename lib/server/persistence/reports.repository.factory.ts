import "server-only";

import { isPersistenceEnabled } from "@/lib/config/persistence-mode";
import type { ReportsRepository } from "@/lib/server/persistence/reports.repository.interface";
import type { CreateReportInput, CreateReportResult } from "@/lib/server/persistence/reports.types";
import { reportFailure } from "@/lib/server/persistence/reports.types";
import { createSupabaseReportsRepository } from "@/lib/server/persistence/adapters/supabase/reports.repository";

const persistenceDisabledRepository: ReportsRepository = {
  async createOrGetOpenReport(): Promise<CreateReportResult> {
    return reportFailure("PERSISTENCE_DISABLED");
  },
};

/** Wires the active alpha persistence adapter. Route imports this only. */
export function createReportsRepository(): ReportsRepository {
  if (!isPersistenceEnabled()) {
    return persistenceDisabledRepository;
  }
  return createSupabaseReportsRepository();
}

export type { CreateReportInput, CreateReportResult };
