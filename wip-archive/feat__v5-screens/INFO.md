# feat/v5-screens

- source: (local branch, no worktree)
- branch: feat/v5-screens
- HEAD: add39449ba9afb1e12c60042b427da22d3e7674c
- last commit: 2026-06-16T19:18:23+05:30 "feat(u1): rebuild Home to the v5 reference (official + community rails)"
- base: origin/master at archive time (802bc31c2dbb3007b9a26cdda9124a69a0841fd8)
- commits archived: 15
- uncommitted: none
- excluded: none

## restore

```
git switch -c restore/feat__v5-screens add39449ba9a   # if the sha still exists locally; else start from origin/master
git am wip-archive/feat__v5-screens/commits/*.patch
git apply wip-archive/feat__v5-screens/uncommitted.diff
cp -r wip-archive/feat__v5-screens/untracked/. .
```
