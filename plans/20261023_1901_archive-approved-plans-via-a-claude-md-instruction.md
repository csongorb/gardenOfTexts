# Archive approved plans via a CLAUDE.md instruction

## Context
Plan mode always writes to one file named by Claude Code (e.g. `~/.claude/plans/i-want-to-per-hazy-hennessy.md`), and that file is reused and overwritten within a session. This session produced six plans, and only the last one still exists.

The goal is to keep a growing, dated record of the approved plans inside the project, in `plans/`, next to the process journal. You chose to do this with a simple instruction in a new `claude.md`, which Claude reads at the start of every session.

> **Note: there are better solutions.** An instruction relies on Claude remembering to copy the plan after every approval. It can be forgotten, especially in long sessions or after the conversation has been summarized. Each copy is also a visible extra step that may ask for permission. A more reliable alternative is a **Claude Code hook** in `.claude/settings.json` (`PostToolUse` with matcher `ExitPlanMode`). Claude Code itself runs it on every approval and gets the plan text passed in, so a one-line `jq` shell command can save it, with nothing to remember. Switch to that if plans start going missing from the archive.

## What gets added

```
gardenOfTexts/
├── CLAUDE.md          ← NEW: project instructions for Claude (committed)
└── plans/             ← NEW: one file per approved plan
    ├── 20261023_1550_archive-approved-plans-via-a-claude-md-instruction.md
    └── …
```

### `CLAUDE.md`
```markdown
# Garden of Texts – notes for Claude

## Plan archive
After a plan is approved (ExitPlanMode accepted), copy the approved plan file unchanged to
`Journal/plans/YYYYMMDD_hhmm_<topic>.md` before starting the implementation:
- `YYYYMMDD_hhmm`: local date and time of the approval
- `<topic>`: the plan's first `# ` heading as a slug (lowercase, `a-z0-9` and `-` only, max 60 characters)
- never overwrite an existing file; add `_2`, `_3` … instead
Only approved plans are archived, rejected versions are not.
```

Nothing else changes.

## Steps after approval
1. Create `CLAUDE.md` with the content above.
2. Follow the new rule right away: copy this plan to `Journal/plans/20261023_<hhmm>_archive-approved-plans-via-a-claude-md-instruction.md` as the first entry.

## Verification
- `Journal/plans/` contains this plan with the right name and an unchanged copy (`diff` against the plan file).
- Real check: in the next session, approve a plan. Claude should copy it to `plans/` before implementing, without being reminded.
