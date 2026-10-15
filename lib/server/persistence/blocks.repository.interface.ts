import type { CreateBlockForProfileResult } from "@/lib/db/repositories/blocks.repository";

export interface BlocksRepository {
  createForProfile(input: {
    blockerUserId: string;
    targetProfileId: string;
  }): Promise<CreateBlockForProfileResult>;
}
