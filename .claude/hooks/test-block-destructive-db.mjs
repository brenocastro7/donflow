import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const hook = join(dirname(fileURLToPath(import.meta.url)), "block-destructive-db.mjs");

const cases = [
  {
    name: "consent env + migrate reset",
    input: {
      tool_name: "PowerShell",
      tool_input: {
        command:
          '$env:PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="yes"; npx prisma migrate reset --force',
      },
    },
    expect: "deny",
  },
  {
    name: "plain migrate reset",
    input: { tool_name: "Bash", tool_input: { command: "npx prisma migrate reset --force" } },
    expect: "deny",
  },
  {
    name: "db:reset",
    input: { tool_name: "Bash", tool_input: { command: "npm run db:reset" } },
    expect: "deny",
  },
  {
    name: "force-reset",
    input: { tool_name: "Bash", tool_input: { command: "npx prisma db push --force-reset" } },
    expect: "deny",
  },
  {
    name: "DROP DATABASE",
    input: { tool_name: "Bash", tool_input: { command: 'psql -c "DROP DATABASE foo"' } },
    expect: "deny",
  },
  {
    name: "TRUNCATE",
    input: {
      tool_name: "Bash",
      tool_input: { command: 'sqlite3 prisma/dev.db "TRUNCATE users"' },
    },
    expect: "deny",
  },
  {
    name: "docker compose down -v",
    input: { tool_name: "Bash", tool_input: { command: "docker compose down -v" } },
    expect: "deny",
  },
  {
    name: "dropdb",
    input: { tool_name: "Bash", tool_input: { command: "dropdb donflow_dev" } },
    expect: "deny",
  },
  {
    name: "DATABASE_URL pointing at prod",
    input: {
      tool_name: "Bash",
      tool_input: {
        command: 'DATABASE_URL="postgres://user:pass@host/donflow_production" npx prisma migrate reset',
      },
    },
    expect: "deny",
  },
  {
    name: "DELETE FROM (ask, not deny)",
    input: { tool_name: "Bash", tool_input: { command: 'psql -c "DELETE FROM appointments"' } },
    expect: "ask",
  },
  {
    name: "safe migrate",
    input: { tool_name: "Bash", tool_input: { command: "npm run db:migrate" } },
    expect: "allow",
  },
  {
    name: "real production migration command used by this project",
    input: {
      tool_name: "Bash",
      tool_input: { command: "npm exec --workspace=apps/api -- prisma migrate deploy" },
    },
    expect: "allow",
  },
  {
    name: "unrelated command",
    input: { tool_name: "Bash", tool_input: { command: "npm run test" } },
    expect: "allow",
  },
  {
    name: "textual mention of the bypass var (e.g. in a commit message), not an assignment",
    input: {
      tool_name: "Bash",
      tool_input: {
        command:
          'git commit -m "docs: mention PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION in the readme"',
      },
    },
    expect: "allow",
  },
];

let failed = 0;
for (const c of cases) {
  const stdin = JSON.stringify(c.input);
  const r = spawnSync(process.execPath, [hook], {
    input: stdin,
    encoding: "utf8",
  });
  let decision = "PARSE_FAIL";
  try {
    decision = JSON.parse(r.stdout).hookSpecificOutput.permissionDecision;
  } catch {
    // ignore
  }
  const expectedExit = c.expect === "deny" ? 2 : 0;
  const ok = decision === c.expect && r.status === expectedExit;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "OK" : "FAIL"} | ${c.name} | expect=${c.expect} got=${decision} exit=${r.status}`,
  );
}

process.exit(failed ? 1 : 0);
