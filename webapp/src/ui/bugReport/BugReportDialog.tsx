// Report a bug, in the app (docs/archive/2026-11-21-bug-reporting.md, phase 2). Not drawn on any
// board: it follows Settings and About (a 600 px dialog, a full sheet on phones) and the add-city
// field style.
//
// Nothing leaves the browser until Send. The diagnostics are shown, word for word, whenever they're
// included. Issues are public, so the dialog says not to type personal details; the optional
// email goes to the developer privately, never into the issue. If sending fails, GitHub's own form
// is offered with what was typed already filled in.

import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { bugReportUrl } from '../../app/bugReport';
import type { BugReportService } from '../../app/bugReportClient';
import { REPORT_LIMITS } from '../../app/bugReportLimits';
import buttons from '../buttons.module.css';
import { Dialog } from '../dialog/Dialog';
import { CloseIcon } from '../icons';
import styles from './BugReportDialog.module.css';

/** Same loose check as the server: one @, no spaces, a dot in the domain. */
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/u;

type Status =
  | { kind: 'editing' }
  | { kind: 'sending' }
  | { kind: 'sent'; number: number; url: string }
  | { kind: 'failed'; message: string };

export interface BugReportDialogProps {
  service: BugReportService;
  /** `diagnosticsText()`: shown, and sent if the box stays ticked. */
  diagnostics: string;
  onClose: () => void;
}

function External({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
      {children}
    </a>
  );
}

export function BugReportDialog({ service, diagnostics, onClose }: BugReportDialogProps) {
  const id = useId();
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [email, setEmail] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [errors, setErrors] = useState<{ description?: string; email?: string }>({});
  const [status, setStatus] = useState<Status>({ kind: 'editing' });
  const honeypot = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const abort = useRef<AbortController | null>(null);

  // Closing mid-send drops the answer rather than setting state on an unmounted dialog.
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (status.kind === 'sent') resultRef.current?.focus();
  }, [status.kind]);

  const trimmed = {
    description: description.trim(),
    steps: steps.trim(),
    email: email.trim(),
  };
  const fallbackUrl = bugReportUrl({
    summary: trimmed.description.split('\n', 1)[0] ?? '',
    'what-happened': trimmed.description,
    steps: trimmed.steps,
    ...(includeDiagnostics && { diagnostics }),
  });

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status.kind === 'sending') return;
    const found: typeof errors = {};
    if (!trimmed.description) found.description = 'Describe what went wrong.';
    if (trimmed.email && !EMAIL.test(trimmed.email)) {
      found.email = 'Enter an email address, or leave this empty.';
    }
    setErrors(found);
    if (found.description) {
      descriptionRef.current?.focus();
      return;
    }
    if (found.email) {
      emailRef.current?.focus();
      return;
    }

    setStatus({ kind: 'sending' });
    const controller = new AbortController();
    abort.current = controller;
    const result = await service.send(
      {
        description: trimmed.description,
        ...(trimmed.steps && { steps: trimmed.steps }),
        ...(trimmed.email && { email: trimmed.email }),
        ...(includeDiagnostics && { diagnostics }),
        website: honeypot.current?.value ?? '',
      },
      controller.signal,
    );
    if (controller.signal.aborted) return;
    setStatus(
      result.ok
        ? { kind: 'sent', number: result.number, url: result.url }
        : { kind: 'failed', message: result.message },
    );
  };

  const header = (
    <div className={styles.header}>
      <h2 id={`${id}-title`} className={styles.title}>
        Report a bug
      </h2>
      <button
        type="button"
        className={`${buttons.icon} ${styles.close}`}
        aria-label="Close"
        onClick={onClose}
      >
        <CloseIcon size={22} />
      </button>
    </div>
  );

  if (status.kind === 'sent') {
    return (
      <Dialog labelledBy={`${id}-title`} onClose={onClose} fit className={styles.dialog}>
        <div className={styles.body}>
          {header}
          <div role="status" className={styles.sent}>
            <p ref={resultRef} tabIndex={-1} className={styles.sentTitle}>
              Thanks! Your report is issue #{status.number}.
            </p>
            <p className={styles.text}>
              <External href={status.url}>{`See issue #${status.number} on GitHub`}</External>
            </p>
          </div>
          <div className={styles.footer}>
            <span />
            <button type="button" className={`${buttons.primary} ${styles.send}`} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </Dialog>
    );
  }

  const sending = status.kind === 'sending';
  const describedBy = (...ids: (string | false | undefined)[]) =>
    ids.filter(Boolean).join(' ') || undefined;

  return (
    <Dialog
      labelledBy={`${id}-title`}
      describedBy={`${id}-public`}
      onClose={onClose}
      fit
      className={styles.dialog}
    >
      <form className={styles.body} noValidate onSubmit={(e) => void submit(e)}>
        {header}

        <p id={`${id}-public`} className={styles.notice}>
          Reports become <strong>public</strong> issues on GitHub. Don’t include personal details
          such as your name, email address or where you live.
        </p>

        <div className={styles.field}>
          <label htmlFor={`${id}-description`} className={styles.label}>
            What went wrong?
          </label>
          <textarea
            ref={descriptionRef}
            id={`${id}-description`}
            className={styles.input}
            rows={4}
            maxLength={REPORT_LIMITS.description}
            value={description}
            aria-required="true"
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={describedBy(
              errors.description && `${id}-description-error`,
              `${id}-description-hint`,
            )}
            data-autofocus
            onChange={(e) => {
              setDescription(e.target.value);
            }}
          />
          {errors.description && (
            <p id={`${id}-description-error`} className={styles.error}>
              {errors.description}
            </p>
          )}
          <p id={`${id}-description-hint`} className={styles.hint}>
            What you did, what you saw, and what you expected. Up to 2,000 characters.
          </p>
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-steps`} className={styles.label}>
            Steps to reproduce <span className={styles.optional}>(optional)</span>
          </label>
          <textarea
            id={`${id}-steps`}
            className={styles.input}
            rows={3}
            maxLength={REPORT_LIMITS.steps}
            value={steps}
            onChange={(e) => {
              setSteps(e.target.value);
            }}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-email`} className={styles.label}>
            Email <span className={styles.optional}>(optional)</span>
          </label>
          <input
            ref={emailRef}
            id={`${id}-email`}
            className={styles.input}
            type="email"
            autoComplete="email"
            maxLength={REPORT_LIMITS.email}
            value={email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy(errors.email && `${id}-email-error`, `${id}-email-hint`)}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
          {errors.email && (
            <p id={`${id}-email-error`} className={styles.error}>
              {errors.email}
            </p>
          )}
          <p id={`${id}-email-hint`} className={styles.hint}>
            Only if you’d like a reply. It goes to the developer privately and is never added to the
            public issue.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={includeDiagnostics}
              aria-describedby={includeDiagnostics ? `${id}-diagnostics` : undefined}
              onChange={(e) => {
                setIncludeDiagnostics(e.target.checked);
              }}
            />
            Include diagnostics
          </label>
          {includeDiagnostics ? (
            <>
              <p className={styles.hint}>This is sent with your report, exactly as shown:</p>
              <pre id={`${id}-diagnostics`} className={styles.diagnostics}>
                {diagnostics}
              </pre>
            </>
          ) : (
            <p className={styles.hint}>
              Your app version, browser, time zone and settings won’t be sent.
            </p>
          )}
        </div>

        {/* A field for bots only: hidden from people and screen readers, and out of the Tab order. */}
        <div className={styles.trap} aria-hidden="true">
          <label>
            Website
            <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {status.kind === 'failed' && (
          <div role="alert" className={styles.failed}>
            <p className={styles.failedTitle}>Your report wasn’t sent. {status.message}</p>
            <p className={styles.text}>
              You can try again, or <External href={fallbackUrl}>report it on GitHub</External> with
              what you’ve written filled in (needs a GitHub account).
            </p>
          </div>
        )}

        <p className={styles.small}>
          Sending checks for spam with Google reCAPTCHA, which loads only when you press Send.
          Google’s <External href="https://policies.google.com/privacy">Privacy Policy</External>{' '}
          and <External href="https://policies.google.com/terms">Terms of Service</External> apply.
        </p>

        <div className={styles.footer}>
          <External href={fallbackUrl}>Use GitHub instead</External>
          <span className={styles.actions}>
            <button type="button" className={buttons.secondary} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`${buttons.primary} ${styles.send}`}
              aria-disabled={sending ? true : undefined}
            >
              {sending ? 'Sending…' : 'Send report'}
            </button>
          </span>
        </div>
      </form>
    </Dialog>
  );
}
