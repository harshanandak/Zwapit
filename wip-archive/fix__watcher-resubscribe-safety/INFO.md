# fix/watcher-resubscribe-safety

- source: (local branch, no worktree)
- branch: fix/watcher-resubscribe-safety
- HEAD: 196c5dec37a8c04c7da3ad6add2bcc6216b2bfde
- last commit: 2026-08-30T14:03:22+05:30 "fix(watcher): keep loader seed from rearming alerts (kernel ffea45c9)"
- base: origin/master at archive time (802bc31c2dbb3007b9a26cdda9124a69a0841fd8)
- commits archived: 6
- uncommitted: none
- excluded: none

## restore

```
git switch -c restore/fix__watcher-resubscribe-safety 196c5dec37a8   # if the sha still exists locally; else start from origin/master
git am wip-archive/fix__watcher-resubscribe-safety/commits/*.patch
git apply wip-archive/fix__watcher-resubscribe-safety/uncommitted.diff
cp -r wip-archive/fix__watcher-resubscribe-safety/untracked/. .
```
