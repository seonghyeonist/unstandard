import { setTimeout as delay } from "node:timers/promises";

type Deploy = { id: string; status: string; commit?: { id: string } };
type Service = {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  branch: string;
  repo: string;
  autoDeploy: string;
  suspended: string;
  serviceDetails: { plan: string; healthCheckPath: string; url: string };
};

const commit = process.env.GITHUB_SHA ?? "";
const token = process.env.B2C_RENDER_API_TOKEN;
const id = process.env.B2C_RENDER_SERVICE_ID ?? "";
if (process.env.GITHUB_REPOSITORY !== "seonghyeonist/unstandard" ||
    process.env.GITHUB_REF !== "refs/heads/pivot/b2c-v4-p2-paddle" ||
    process.env.B2C_RENDER_DEPLOY_CONFIRM !== "p2-free-no-payment-method" ||
    !token || !/^srv-[a-z0-9]+$/.test(id) || !/^[a-f0-9]{40}$/.test(commit)) {
  throw new Error("P2 Render scope, verified $0 workspace and exact revision required");
}

const servicePath = "/services/" + id;

async function api<T>(path: string, payload?: object): Promise<T> {
  const response = await fetch("https://api.render.com/v1" + path, {
    method: payload ? "POST" : "GET",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Render API status " + response.status);
  return (response.status === 202 || response.status === 204 ? undefined : await response.json()) as T;
}

async function probe(origin: string, sha: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const options = { redirect: "error", signal: AbortSignal.timeout(12_000) } as const;
      const health = await fetch(origin + "/healthz", options);
      if (health.status === 204 && health.headers.get("x-b2c-revision") === sha) {
        const checkout = await fetch(origin + "/checkout", options);
        const webhook = await fetch(origin + "/api/b2c/webhooks/polar", { ...options, method: "POST" });
        if (checkout.status === 401 && checkout.headers.has("www-authenticate") &&
            webhook.status === 401 && (await webhook.json()).error === "invalid_signature") return true;
      }
    } catch {
      // Cold starts and revision changes can interrupt a probe. Report only the final result.
    }
    await delay(5_000);
  }
  return false;
}

const pendingStatuses = new Set(["created", "queued", "build_in_progress", "pre_deploy_in_progress", "update_in_progress"]);
const service = await api<Service>(servicePath);
const details = service.serviceDetails;
if (service.id !== id || service.ownerId !== "tea-dc2jmte8bjmc73ftjkg0" ||
    service.name !== "unstandard-b2c-p2" || service.type !== "web_service" ||
    service.repo.replace(/\.git$/, "") !== "https://github.com/seonghyeonist/unstandard" ||
    service.branch !== "pivot/b2c-v4-p2-paddle" || service.autoDeploy !== "no" ||
    service.suspended !== "not_suspended" || details.plan !== "free" || details.healthCheckPath !== "/healthz") {
  throw new Error("Render service does not match the dedicated P2 configuration");
}
const origin = new URL(details.url);
if (origin.protocol !== "https:" || !origin.hostname.endsWith(".onrender.com") || origin.origin !== details.url) {
  throw new Error("Unexpected Render HTTPS origin");
}

async function waitForDeploy(deploy: Deploy, expected: string) {
  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    const state = await api<Deploy>(servicePath + "/deploys/" + deploy.id);
    if (!pendingStatuses.has(state.status)) {
      console.info("render_deploy_status", state.id, state.status);
      return state.status === "live" && state.commit?.id === expected ? "live" : "failed";
    }
    await delay(10_000);
  }
  throw new Error("Render deployment still pending; inspect the existing deploy before retrying");
}

const history = (await api<{ deploy: Deploy }[]>(servicePath + "/deploys?limit=20")).map(({ deploy }) => deploy);
if (history.some((deploy) => pendingStatuses.has(deploy.status))) {
  throw new Error("Existing Render deploy in progress; inspect it before issuing a new deploy");
}
const previous = history.find((deploy) => deploy.status === "live");
if (previous?.commit?.id === commit) {
  if (!await probe(origin.origin, commit)) throw new Error("Existing revision failed the HTTPS probe");
  console.info("render_revision_already_verified", commit);
} else {
  if (history.some((deploy) => deploy.commit?.id === commit)) {
    throw new Error("This SHA already has a Render attempt; inspect it before deploying another revision");
  }
  const previousSha = previous?.commit?.id;
  if (previous && (!previousSha || !await probe(origin.origin, previousSha))) {
    throw new Error("The rollback target could not be verified");
  }
  const requested = await api<Deploy>(servicePath + "/deploys", { commitId: commit });
  const status = await waitForDeploy(requested, commit);
  if (status === "live" && await probe(origin.origin, commit)) {
    console.info("render_revision_verified", commit);
  } else {
    if (previous && previousSha) {
      if (!await probe(origin.origin, previousSha)) {
        const rollback = await api<Deploy>(servicePath + "/rollback", { deployId: previous.id });
        if (await waitForDeploy(rollback, previousSha) !== "live" || !await probe(origin.origin, previousSha)) {
          throw new Error("Render rollback could not be verified");
        }
      }
      console.info("render_previous_revision_healthy", previousSha);
    } else {
      await api(servicePath + "/suspend", {});
      let stopped = await api<Service>(servicePath);
      for (let attempt = 0; attempt < 5 && stopped.suspended !== "suspended"; attempt++) {
        await delay(2_000);
        stopped = await api<Service>(servicePath);
      }
      if (stopped.suspended !== "suspended") throw new Error("Initial Render service suspension unverified");
      console.info("render_initial_service_suspended");
    }
    throw new Error("New Render revision failed verification");
  }
}
