import { describe, expect, it } from 'vitest';
import { issueFromReport } from './issue.js';

describe('issueFromReport', () => {
  it('titles the issue from the first line of the description', () => {
    const issue = issueFromReport({ description: 'Sydney is an hour off\nafter the change' });
    expect(issue.title).toBe('[Bug]: Sydney is an hour off');
    expect(issue.labels).toEqual(['bug']);
  });

  it('caps long titles', () => {
    const issue = issueFromReport({ description: 'a'.repeat(500) });
    expect(Array.from(issue.title.replace('[Bug]: ', ''))).toHaveLength(80);
    expect(issue.title.endsWith('…')).toBe(true);
  });

  it('puts every user field inside a code block', () => {
    const issue = issueFromReport({
      description: '@octocat see owner/repo#1',
      steps: '<img src=x onerror=alert(1)>',
      diagnostics: 'App version: 1.0.1',
    });
    expect(issue.body).toContain('```text\n@octocat see owner/repo#1\n```');
    expect(issue.body).toContain('```text\n<img src=x onerror=alert(1)>\n```');
    expect(issue.body).toContain('```text\nApp version: 1.0.1\n```');
  });

  it('says what was left out', () => {
    const issue = issueFromReport({ description: 'x' });
    expect(issue.body).toContain('### Steps to reproduce\n\n_Not given._');
    expect(issue.body).toContain('### Diagnostics\n\n_Not included._');
    expect(issue.body).toContain('_No contact email was left._');
  });

  it('never puts the reporter’s email in the issue', () => {
    const email = 'reporter@example.com';
    const issue = issueFromReport({ description: 'x', email });
    expect(issue.body).not.toContain(email);
    expect(issue.title).not.toContain(email);
    expect(JSON.stringify(issue)).not.toContain('example.com');
    expect(issue.body).toContain('stored privately');
  });
});
