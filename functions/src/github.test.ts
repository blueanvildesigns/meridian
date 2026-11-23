import { describe, expect, it, vi } from 'vitest';
import { createIssue, GitHubError } from './github.js';

const draft = { title: '[Bug]: x', body: 'body', labels: ['bug'] };

function fakeFetch(status: number, body: unknown) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
    ),
  );
}

describe('createIssue', () => {
  it('posts the draft to the repo with the token and API version', async () => {
    const f = fakeFetch(201, { number: 42, html_url: 'https://github.com/o/r/issues/42' });
    const issue = await createIssue(draft, { token: 'tok', repo: 'o/r', fetch: f });
    expect(issue).toEqual({ number: 42, url: 'https://github.com/o/r/issues/42' });
    const [url, init] = f.mock.calls[0] ?? [];
    expect(url).toBe('https://api.github.com/repos/o/r/issues');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer tok',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    });
    expect(JSON.parse(init?.body as string)).toEqual(draft);
  });

  it('turns an error answer into a GitHubError without the token', async () => {
    const f = fakeFetch(403, { message: 'Resource not accessible by personal access token' });
    const err = await createIssue(draft, { token: 'secret-token', repo: 'o/r', fetch: f }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(GitHubError);
    expect((err as GitHubError).status).toBe(403);
    expect((err as GitHubError).message).toContain('Resource not accessible');
    expect((err as GitHubError).message).not.toContain('secret-token');
  });

  it('refuses a 201 without an issue number', async () => {
    const f = fakeFetch(201, { nope: true });
    await expect(createIssue(draft, { token: 't', repo: 'o/r', fetch: f })).rejects.toThrow(
      GitHubError,
    );
  });

  it.each(['o/r/x', '../r', 'o', 'o/r?x=1'])('refuses the repo name %s', async (repo) => {
    const f = fakeFetch(201, {});
    await expect(createIssue(draft, { token: 't', repo, fetch: f })).rejects.toThrow(
      'Bad repository name',
    );
    expect(f).not.toHaveBeenCalled();
  });
});
