"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_AUTHORS, DEFAULT_CONFIG } from "@pr-radar/core/config/default";
import { PrTable } from "@/components/PrTable";
import type { FetchResult } from "@/lib/types";

const DEFAULT_REPOS = DEFAULT_CONFIG.repos.map(({ repo }) => repo);
const POLL_MS = 15 * 60 * 1000;

export default function Home() {
  const [results, setResults] = useState<FetchResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [fetchedAuthors, setFetchedAuthors] = useState<Set<string>>(new Set(DEFAULT_AUTHORS));
  const [loadingAuthors, setLoadingAuthors] = useState<Set<string>>(new Set());
  const [loadedRepos, setLoadedRepos] = useState<Set<string>>(new Set());
  const [loadingRepos, setLoadingRepos] = useState<Set<string>>(new Set());

  const load = useCallback(async (force = false) => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/prs${force ? "?refresh=1" : ""}`,
      );
      if (res.status === 401) { setNeedsAuth(true); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNeedsAuth(false);
      const incoming = await res.json() as FetchResult[];
      setResults(incoming);
      setFetchedAuthors(new Set([
        ...DEFAULT_AUTHORS,
        ...incoming.flatMap((result) => result.prs.map((pr) => pr.author)),
      ]));
      setLoadedRepos(new Set(DEFAULT_REPOS));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadForAuthors = useCallback((newAuthors: string[]) => {
    setFetchedAuthors((prev) => new Set([...prev, ...newAuthors]));
  }, []);

  const loadForRepos = useCallback(async (newRepos: string[]) => {
    const toFetch = newRepos.filter((r) => !loadedRepos.has(r) && !loadingRepos.has(r));
    if (toFetch.length === 0) return;

    setLoadingRepos((prev) => new Set([...prev, ...toFetch]));
    try {
      const res = await fetch(`/api/prs?repos=${toFetch.join(",")}`);
      if (!res.ok) return;
      const incoming = await res.json() as FetchResult[];
      setResults((prev) => {
        const map = new Map(prev.map((r) => [r.repo, { ...r, prs: [...r.prs] }]));
        for (const r of incoming) {
          const existing = map.get(r.repo);
          if (existing) {
            const knownIds = new Set(existing.prs.map((p) => p.number));
            existing.prs.push(...r.prs.filter((p) => !knownIds.has(p.number)));
          } else {
            map.set(r.repo, r);
          }
        }
        return Array.from(map.values());
      });
      setFetchedAuthors((prev) => new Set([
        ...prev,
        ...incoming.flatMap((result) => result.prs.map((pr) => pr.author)),
      ]));
      setLoadedRepos((prev) => new Set([...prev, ...toFetch]));
    } finally {
      setLoadingRepos((prev) => {
        const next = new Set(prev);
        toFetch.forEach((r) => next.delete(r));
        return next;
      });
    }
  }, [loadedRepos, loadingRepos]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (needsAuth) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-gray-400">
        <p className="text-sm">No GitHub token available.</p>
        <a
          href="/sign-in"
          className="rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        {error} — <button onClick={() => void load()} className="ml-2 underline">retry</button>
      </div>
    );
  }

  if (results.length === 0 && refreshing) {
    return <div className="flex h-full items-center justify-center text-gray-500 text-sm">Loading PRs…</div>;
  }

  return (
    <PrTable
      results={results}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      fetchedAuthors={fetchedAuthors}
      loadingAuthors={loadingAuthors}
      onFetchAuthors={loadForAuthors}
      loadedRepos={loadedRepos}
      loadingRepos={loadingRepos}
      onFetchRepos={loadForRepos}
    />
  );
}
