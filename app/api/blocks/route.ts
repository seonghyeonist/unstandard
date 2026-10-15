import { getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { privateJson } from "@/lib/http/private-json";
import { isSameOriginMutation, readSmallJson } from "@/lib/http/profile-request";
import { createBlocksRepository } from "@/lib/server/persistence/blocks.repository.factory";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return privateJson({ error: "Forbidden" }, { status: 403 });
  }
  if (!isDatabaseRuntime()) {
    return privateJson({ error: "Block service unavailable" }, { status: 503 });
  }

  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return privateJson({ error: "Block service unavailable" }, { status: 503 });
    }
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user) return privateJson({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await readSmallJson(request);
  } catch {
    return privateJson({ error: "Invalid block request" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return privateJson({ error: "Invalid block request" }, { status: 400 });
  }

  const targetProfileId = (body as Record<string, unknown>).profileId;
  if (typeof targetProfileId !== "string") {
    return privateJson({ error: "Invalid block request" }, { status: 400 });
  }

  const result = await createBlocksRepository().createForProfile({
    blockerUserId: user.id,
    targetProfileId,
  });
  if (!result.ok) {
    if (result.code === "INVALID_PROFILE_ID") {
      return privateJson({ error: "Invalid profile" }, { status: 400 });
    }
    if (result.code === "PROFILE_NOT_FOUND") {
      return privateJson({ error: "Profile not found" }, { status: 404 });
    }
    if (result.code === "SELF_BLOCK") {
      return privateJson({ error: "Cannot block yourself" }, { status: 400 });
    }
    return privateJson({ error: "Block service unavailable" }, { status: 503 });
  }

  return privateJson({ blocked: true, inserted: result.inserted }, {
    status: result.inserted ? 201 : 200,
  });
}
