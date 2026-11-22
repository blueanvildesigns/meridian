# Bug reporting: owner setup checklist

The steps only you can do, in the order they depend on each other. Decisions: `docs/archive/2026-11-21-bug-reporting.md`.

- **Phase 1** (GitHub form and link): part 1 only.

Repo: `blueanvildesigns/meridian` · Firebase project: `meridian-web-a5829`.

---

## Part 1: GitHub (needed for Phase 1)

### 1.1 Issues are on
- [x] Checked 2026-11-21 with `gh api repos/blueanvildesigns/meridian --jq .has_issues`: **true**. Nothing to do.
- If it's ever off: GitHub → the repo → **Settings** → **General** → **Features** → tick **Issues**.

### 1.2 Labels
`bug` already exists (GitHub's default, red `#d73a4a`). `needs-triage` doesn't, and the triage workflow fails until it does.

- [ ] Create `needs-triage`, either way:
  - Terminal:
    ```bash
    gh label create needs-triage -R blueanvildesigns/meridian --color FBCA04 --description "New issue, not yet looked at"
    ```
  - Or the web: the repo → **Issues** → **Labels** → **New label** → Label name `needs-triage`, Description `New issue, not yet looked at`, Color `#FBCA04` → **Create label**.
- [ ] Check both exist:
  ```bash
  gh label list -R blueanvildesigns/meridian --search triage
  ```

### 1.3 Workflow permissions
The triage workflow asks for `issues: write` in its own file, which works with the repo's read-only default token. Nothing to change. Check, if you want: the repo → **Settings** → **Actions** → **General** → **Workflow permissions** can stay on **Read repository contents and packages permissions**.

### 1.4 After Phase 1 merges
- [ ] Open the live site → footer → **Report a bug**. GitHub's form should open with **Diagnostics** filled in. Check it shows nothing but version, browser, OS, time zone, time format and locale.
- [ ] Submit a test issue titled `[Bug]: test, please ignore`. Within a minute it should get the `needs-triage` label and the thank-you comment (the repo → **Actions** → **Issue triage** shows the run).
- [ ] Delete the test issue: open it → right-hand sidebar, bottom → **Delete issue** → **Delete this issue!** (Only admins can delete; closing works too.)
- [ ] Check **New issue** shows only the Bug report form, with no "Open a blank issue" link (that's `config.yml`).
