// Creating an issue through GitHub's REST API (POST /repos/{owner}/{repo}/issues).
// The token is a fine-grained PAT with Issues: write on this one repo, read from Secret Manager.

import type { IssueDraft } from './issue.js';

export interface CreatedIssue {
  number: number;
  url: string;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface GitHubOptions {
  token: string;
  /** "owner/name". */
  repo: string;
  fetch?: typeof fetch;
  /** Give up after this long, well inside Hosting's 60-second limit. */
  timeoutMs?: number;
}

const REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

export async function createIssue(
  draft: IssueDraft,
  options: GitHubOptions,
): Promise<CreatedIssue> {
  const { token, repo, fetch: doFetch = fetch, timeoutMs = 15_000 } = options;
  if (!REPO.test(repo)) throw new GitHubError(`Bad repository name: ${repo}`, 0);
  const res = await doFetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'meridian-bug-report',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(draft),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status !== 201) {
    // GitHub's error body says why (bad token, missing permission, abuse limit); it never echoes
    // the token, so it's safe to log. Cap it in case of an HTML error page.
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new GitHubError(`GitHub answered ${res.status}: ${detail}`, res.status);
  }
  const json = (await res.json()) as { number?: unknown; html_url?: unknown };
  if (typeof json.number !== 'number' || typeof json.html_url !== 'string') {
    throw new GitHubError('GitHub answered 201 without an issue number or URL', res.status);
  }
  return { number: json.number, url: json.html_url };
}
