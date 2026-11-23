// The public GitHub issue made from a validated report. The reporter's email is never part of it;
// the body says only whether one was left (it's kept privately, see contacts.ts).

import { MAX_TITLE } from './limits.js';
import { codeBlock, sanitizeLine, truncate } from './sanitize.js';
import type { BugReport } from './validate.js';

export interface IssueDraft {
  title: string;
  body: string;
  labels: string[];
}

export function issueFromReport(report: BugReport): IssueDraft {
  const firstLine = sanitizeLine(report.description.split('\n', 1)[0] ?? '');
  const title = `[Bug]: ${truncate(firstLine || 'In-app report', MAX_TITLE)}`;
  const body = [
    '_Sent from the in-app bug report form. Everything below the headings is exactly what the reporter typed or chose to include._',
    '',
    '### What happened',
    '',
    codeBlock(report.description),
    '',
    '### Steps to reproduce',
    '',
    report.steps ? codeBlock(report.steps) : '_Not given._',
    '',
    '### Diagnostics',
    '',
    report.diagnostics ? codeBlock(report.diagnostics) : '_Not included._',
    '',
    '---',
    report.email
      ? '_The reporter left a contact email. It is stored privately and is not shown here._'
      : '_No contact email was left._',
  ].join('\n');
  return { title, body, labels: ['bug'] };
}
