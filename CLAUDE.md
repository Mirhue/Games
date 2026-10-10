# CLAUDE.md

This repo is a playground for creating and testing games and game ideas.

## Branch model

- **One game per branch.** Every game or game idea lives on its own branch, named `game/<short-kebab-name>` (for example `game/snake`, `game/tower-defense`).
- **Games are independent.** A game branch never depends on, imports from, or merges with another game branch. Don't share code between games. If two games need the same helper, copy it.
- **`main` holds no game code.** It contains only repo-wide files: this `CLAUDE.md`, `README.md`, and `.gitignore`. Never merge a game branch into `main`.
- **Start a new game from `main`:** `git switch main && git pull && git switch -c game/<name>`. That way it inherits this file.
- Changes to the repo-wide files go to `main` first. Only bring them into an existing game branch when that game needs them.

## Working on a game

- Each game chooses its own language, framework, and tooling. Nothing is shared at the repo level.
- Every game branch has its own `README.md` at the root covering:
  - the idea / core mechanic
  - how to run it (exact commands)
  - how to test it
  - current status (idea, prototype, playable, abandoned) and open ideas
- Keep the game runnable from a fresh clone of its branch. Document every dependency and pin versions (`requirements.txt`, `package.json` + lockfile, etc.).
- Prefer simple setups that need little installation. Browser games (plain HTML/JS or a small bundler) and Python (e.g. `pygame`) both work well in this VM.
- Separate game logic (state, rules, scoring) from rendering and input, so the logic can be unit-tested without a display.
- Write tests for game rules and edge cases. Verify by actually running the game, not only the tests.
- To work on several games in parallel, use a worktree per game: `git worktree add ../Games.<name> game/<name>`.

## Git and credentials

- Remote: `https://github.com/Mirhue/Games`. Authenticate with the repo-specific PAT, stored via `credential.helper=store` with `credential.useHttpPath=true`.
- Never commit secrets, tokens, or `.credentials` files.
- Commit small, focused changes with clear messages. Push the game branch. Never force-push `main`.
