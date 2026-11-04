# Garden of Texts – notes for Claude

## Plan archive
After a plan is approved (ExitPlanMode accepted), copy the approved plan file unchanged to
`plans/YYYYMMDD_hhmm_<topic>.md` before starting the implementation:
- `YYYYMMDD_hhmm`: local date and time of the approval
- `<topic>`: the plan's first `# ` heading as a slug (lowercase, `a-z0-9` and `-` only, max 60 characters)
- never overwrite an existing file; add `_2`, `_3` … instead
Only approved plans are archived, rejected versions are not.
