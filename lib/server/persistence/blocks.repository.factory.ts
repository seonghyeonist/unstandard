import { createBlockForProfile } from "@/lib/db/repositories/blocks.repository";
import type { BlocksRepository } from "@/lib/server/persistence/blocks.repository.interface";

export function createBlocksRepository(): BlocksRepository {
  return { createForProfile: createBlockForProfile };
}
