# feat/29c3c5c2-8e29-4b2a-bebb-197a84efb6f7

- source: C:/Users/harsha_befach/Downloads/Personal-Projects/Zwapit/.worktrees/29c3c5c2-8e29-4b2a-bebb-197a84efb6f7
- branch: feat/29c3c5c2-8e29-4b2a-bebb-197a84efb6f7
- HEAD: 802bc31c2dbb3007b9a26cdda9124a69a0841fd8
- last commit: 2026-08-30T14:17:44+05:30 "fix(watcher): make alert reattachment collision-safe (#53)"
- base: origin/master at archive time (802bc31c2dbb3007b9a26cdda9124a69a0841fd8)
- commits archived: 0
- uncommitted: 24 entries (22 untracked); untracked copied: 22
- excluded: none

## restore

```
git switch -c restore/feat__29c3c5c2-8e29-4b2a-bebb-197a84efb6f7 802bc31c2dbb   # if the sha still exists locally; else start from origin/master
git am wip-archive/feat__29c3c5c2-8e29-4b2a-bebb-197a84efb6f7/commits/*.patch
git apply wip-archive/feat__29c3c5c2-8e29-4b2a-bebb-197a84efb6f7/uncommitted.diff
cp -r wip-archive/feat__29c3c5c2-8e29-4b2a-bebb-197a84efb6f7/untracked/. .
```
