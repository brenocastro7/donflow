# Git workflow

DonFlow uses `main` as its only permanent branch.

## Branches

Create short-lived branches from `main`:

- `feature/*` for features;
- `fix/*` for bug fixes;
- `refactor/*` for internal restructuring;
- `docs/*` for documentation;
- `chore/*` for infrastructure and maintenance.

The current historical branch is named `feat/users`. New branches should follow the
documented convention unless a later decision changes it.

## Commits

Commit records use the project sequence:

```text
DF-<SCOPE>-<NUMBER> <TYPE>: <objective English description>
```

Examples:

```text
DF-CORE-003 DOCS: update project documentation
DF-API-002 FIX: align application bootstrap and tests
DF-WEB-001 FEAT: create public landing page
```

Guidelines:

- one logical objective per commit;
- do not mix independent API and frontend work;
- do not include `.env`, secrets, generated artifacts, or installed dependencies;
- run the relevant verification commands before committing;
- record planned and completed commits in Notion.

## Pull requests

Relevant changes enter `main` through pull requests. Each description includes:

- problem or objective;
- adopted solution;
- verification performed;
- impact on documentation, database, and configuration.

## Minimum verification

```bash
npm run verify
```
