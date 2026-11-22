# Decisions: bug reporting (2026-11-21)

Source: the owner's brief for in-app bug reporting, 2026-11-21. Built in two phases, each its own commit, so Phase 1 can ship alone. Owner steps: `docs/manual-setup-bug-reporting.md`.

## Phase 1: GitHub issue form and an in-app link (no backend)

1. **Issue form** `.github/ISSUE_TEMPLATE/bug_report.yml`: Summary (required), What happened (required), Expected behavior (required), Steps to reproduce, Diagnostics (optional, rendered as a text block). Default label `bug`. `config.yml` turns blank issues off. The form tells reporters that issues are public.
2. **"Report a bug" link** in the footer (between About and Support on Ko-fi) and in a new About section, "Found a bug?", placed before Credits. **No board draws either one**, so both copy their neighbours: the footer's link style and About's section style. The owner should confirm the placement and wording (BR-1 in `docs/decisions-log.md`).
3. **The link opens** `https://github.com/blueanvildesigns/meridian/issues/new?template=bug_report.yml&diagnostics=…` in a new tab. The repo comes from `git remote`. The diagnostics are six lines: app version and commit, user agent (capped at 256 characters), OS name (no version), IANA time zone, time format setting (with what "Browser default" resolves to), and locale.
4. **Privacy.** The diagnostics are built from the browser's own facts plus the time format setting only; the function has no access to saved cities. Nothing leaves the browser until the reporter submits the form on GitHub, where every field is visible and editable.
5. **Length.** Links are capped at 2,000 characters. If a link would be longer, fields are shortened with an ellipsis in this order: steps, what happened, summary, diagnostics. A real set of diagnostics is about 400 characters encoded.
6. **Triage workflow** `.github/workflows/issue-triage.yml`: on every new issue, add `needs-triage` and comment "Thanks for the report! We'll take a look." It uses `gh` with the workflow token (`issues: write` only), never checks out code, and passes only the issue number to the shell, so no issue text can inject commands.
7. **Prefill keys** are the form's field ids (`summary`, `what-happened`, `steps`, `diagnostics`). GitHub documents a field's `id` as its key for URL prefills; changing an id breaks the app's link.

## Open

- BR-1: placement and wording of the two links (not drawn).
- The `needs-triage` label must exist before the workflow can add it (`gh issue edit --add-label` fails on a missing label). Owner step 1.2.
