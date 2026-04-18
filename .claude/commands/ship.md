---
description: Commit + push all changes to GitHub, then deploy to Firebase Hosting
allowed-tools: Bash(git:*), Bash(firebase:*), Read, Grep
---

Ship the current working tree: get everything into GitHub, then deploy to Firebase.

## Steps

1. **Check state** — run `git status` and `git diff` (staged + unstaged) in parallel. If the tree is clean AND the local branch is not ahead of `origin/master`, there is nothing to ship — report that and stop.

2. **Sanity-check what's being committed** — look at the diff. If you see any of the following, **stop and ask the user first**:
   - `.env*` files, credential files, or anything that looks like a secret
   - Large binaries or files under `node_modules/` being tracked
   - Changes outside this project's scope

3. **Run tests** — `npm test`. If tests fail, stop and report; do not proceed to commit.

4. **Commit** — if there are changes to commit:
   - Stage the specific files you intend to ship (avoid `git add -A` so the bash stackdump and stray artefacts don't sneak in). Skip `bash.exe.stackdump` if present.
   - Write a concise commit message (1–2 sentences, imperative mood, focused on *why*). Match the style of `git log --oneline -5`.
   - Commit with the standard `Co-Authored-By` trailer.

5. **Push to GitHub** — `git push origin master` (or the current branch if not master — check with `git rev-parse --abbrev-ref HEAD`). Never force-push.

6. **Deploy to Firebase** — `firebase deploy --only hosting`. This publishes to `https://stickman-wars-13094.web.app` (project configured in `.firebaserc`).

7. **Report** — one-line summary with:
   - Commit SHA (short)
   - Push result
   - Live URL

## Guardrails

- If `git status` shows untracked files you don't recognise (e.g. a new top-level directory), ask the user whether to include them rather than silently skipping or blindly adding.
- Never use `--no-verify`, `--force`, or `git reset --hard`.
- If the Firebase deploy uploads an unexpectedly large number of files (>30), stop and check that `firebase.json`'s `ignore` rules are still working — the repo only has ~23 legitimate hostable files.
