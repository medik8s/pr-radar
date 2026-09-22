import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getCached, setCached, isRevalidating, markRevalidating, fetchRepoOpenPRs, DEFAULT_CONFIG, OPEN_PRS_CACHE_KEY } from "@pr-radar/core";
import type { FetchResult } from "@pr-radar/core";

export const runtime = "nodejs";

async function resolveToken(): Promise<string | undefined> {
  // 1. Server env var — works without any user session
  if (process.env["GITHUB_TOKEN"]) return process.env["GITHUB_TOKEN"];

  // 2. Signed-in user's GitHub OAuth token via Clerk
  try {
    const { userId } = await auth();
    if (userId) {
      const client = await clerkClient();
      const { data } = await client.users.getUserOauthAccessToken(userId, "oauth_github");
      return data[0]?.token;
    }
  } catch {
    // no Clerk session or token
  }

  return undefined;
}

export async function GET(req: Request) {
  const token = await resolveToken();
  if (!token) {
    return NextResponse.json({ error: "no_github_token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  const reposParam = searchParams.get("repos");
  const customRepos: string[] = reposParam
    ? reposParam.split(",").map((r) => r.trim()).filter(Boolean)
    : [];

  // When repos param is provided, fetch only those (custom repos not in DEFAULT_CONFIG).
  // Otherwise fetch all configured repos.
  const defaultCiPatterns = { e2e: ["pj-rehearse*", "*e2e*"], ignore: [] as string[] };
  const repoConfigs = customRepos.length > 0
    ? customRepos.map((repo) => ({ repo, ciPatterns: defaultCiPatterns }))
    : DEFAULT_CONFIG.repos;

  const results = await Promise.all(
    repoConfigs.map(async (repoConfig): Promise<FetchResult> => {
      if (!forceRefresh) {
        const { data, stale } = await getCached(repoConfig.repo, OPEN_PRS_CACHE_KEY);
        if (data && !stale) return data;
        if (data && stale && !isRevalidating(repoConfig.repo, OPEN_PRS_CACHE_KEY)) {
          markRevalidating(repoConfig.repo, OPEN_PRS_CACHE_KEY, true);
          fetchRepoOpenPRs(token, repoConfig)
            .then((fresh) => setCached(fresh, DEFAULT_CONFIG.cacheTtl, OPEN_PRS_CACHE_KEY))
            .catch(() => {})
            .finally(() => markRevalidating(repoConfig.repo, OPEN_PRS_CACHE_KEY, false));
          return data;
        }
        if (data) return data;
      }

      const result = await fetchRepoOpenPRs(token, repoConfig);
      await setCached(result, DEFAULT_CONFIG.cacheTtl, OPEN_PRS_CACHE_KEY);
      return result;
    }),
  );

  return NextResponse.json(results);
}
