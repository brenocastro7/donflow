#!/usr/bin/env node
/**
 * Claude Code hook: PreToolUse (matcher: Bash|PowerShell)
 *
 * Policy: database reset / drop / wipe operations NEVER run via the Agent —
 * not even with the user's confirmation in chat. The user must run
 * `npm run db:reset` (or the equivalent command) in their own terminal,
 * outside the Agent, and type RESET.
 *
 * Faithfully ported from a Cursor IDE hook (devfraga/demo-hooks-ia,
 * .cursor/hooks/block-destructive-db.mjs) — same rule list, same blocking
 * behavior; only the I/O contract changes to match Claude Code's format.
 *
 * Input (stdin JSON, PreToolUse): { session_id, tool_name, tool_input: { command } }
 * Output (stdout JSON): { systemMessage, hookSpecificOutput: { hookEventName:
 *   "PreToolUse", permissionDecision: "allow"|"ask"|"deny", permissionDecisionReason } }
 * Exit 2 = block (extra defense in case the output JSON is ignored — Claude
 * Code has no "failClosed" flag equivalent to Cursor's, so any unexpected
 * error in this script must also fail closed to "deny", never silently
 * "allow").
 */

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, "state");
const LOG_FILE = join(LOG_DIR, "hook-invocations.jsonl");

function logInvocation(entry) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(
      LOG_FILE,
      `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`,
    );
  } catch {
    // logging must never take the hook down
  }
}

function readStdin() {
  try {
    let raw = readFileSync(0, "utf8");
    if (!raw.trim()) return {};
    raw = raw.replace(/^﻿/, "").trim();
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function extractCommand(input) {
  if (typeof input.command === "string") return input.command;

  const toolInput = input.tool_input;
  if (toolInput && typeof toolInput === "object") {
    if (typeof toolInput.command === "string") return toolInput.command;
  }
  if (typeof toolInput === "string") {
    try {
      const parsed = JSON.parse(toolInput);
      if (typeof parsed.command === "string") return parsed.command;
    } catch {
      // ignore
    }
  }
  if (input.arguments && typeof input.arguments.command === "string") {
    return input.arguments.command;
  }
  if (input.input && typeof input.input.command === "string") {
    return input.input.command;
  }

  return "";
}

/**
 * @param {"allow"|"ask"|"deny"} permission
 * @param {{ command: string; tool: string; reason: string | null }} meta
 */
function respond(permission, meta, reason) {
  logInvocation({ permission, commandPreview: meta.command.slice(0, 300), tool: meta.tool, reason });

  const payload = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: permission,
    },
  };
  if (reason) {
    payload.systemMessage =
      permission === "deny"
        ? `Command blocked: ${reason}`
        : `Confirm before continuing: ${reason}`;
    payload.hookSpecificOutput.permissionDecisionReason = `${reason} Safe alternative: npm run db:migrate / npm run db:seed. Do NOT set PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION and do NOT ask for confirmation to work around this — the hook is absolute.`;
  }

  process.stdout.write(JSON.stringify(payload));
  // Exit 2 is extra defense in case the output JSON is ignored — see the
  // note at the top of this file.
  process.exit(permission === "deny" ? 2 : 0);
}

try {
  const input = readStdin();
  const command = extractCommand(input);
  const tool = input.tool_name ?? "unknown";
  // Normalize whitespace / line breaks (multi-line PowerShell, etc.)
  const normalized = command.replace(/\s+/g, " ").trim();

  const resetViaAgentMsg =
    "Database reset via the Agent is blocked absolutely (even with confirmation in chat). Ask the user to run the reset command in their own terminal (outside the Agent) and confirm there.";

  /** @type {{ pattern: RegExp; permission: "deny" | "ask"; reason: string }[]} */
  const rules = [
    // Prisma's own AI-bypass escape hatch. Requires an actual assignment
    // (=) right after the name, not just a textual mention — otherwise this
    // rule blocks harmless things like a commit message or code comment
    // that documents the policy by naming the variable.
    {
      pattern: /PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION\s*=/i,
      permission: "deny",
      reason:
        "Setting PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION bypasses Prisma's own protection. Forbidden via the Agent.",
    },
    {
      pattern: /\b(npm|pnpm|yarn|bun)\s+run\s+db:reset\b/i,
      permission: "deny",
      reason: resetViaAgentMsg,
    },
    {
      pattern: /safe-db-reset/i,
      permission: "deny",
      reason: resetViaAgentMsg,
    },
    // prisma migrate reset (flags / npx / words in between) — do not confuse
    // with "prisma migrate deploy", the legitimate command used by this
    // project's real deploys.
    {
      pattern: /prisma(?:\.cmd)?[\s.]+migrate[\s]+reset\b/i,
      permission: "deny",
      reason:
        "prisma migrate reset drops and recreates the database. Forbidden via the Agent — the user must run it in their own terminal.",
    },
    {
      pattern: /migrate[\s]+reset\b/i,
      permission: "deny",
      reason: "migrate reset drops and recreates the database. Forbidden via the Agent.",
    },
    {
      pattern:
        /prisma(?:\.cmd)?[\s.]+db[\s]+push\b[\s\S]{0,120}--force-reset\b/i,
      permission: "deny",
      reason:
        "prisma db push --force-reset destroys data. Prefer migrate dev/deploy without force-reset.",
    },
    {
      pattern: /--force-reset\b/i,
      permission: "deny",
      reason: "--force-reset destroys the database. Forbidden via the Agent.",
    },
    {
      pattern: /\bdropdb\b/i,
      permission: "deny",
      reason: "dropdb removes an entire PostgreSQL database.",
    },
    {
      pattern: /\bDROP\s+DATABASE\b/i,
      permission: "deny",
      reason: "DROP DATABASE removes the entire database.",
    },
    {
      pattern: /\bDROP\s+SCHEMA\b/i,
      permission: "deny",
      reason: "DROP SCHEMA can wipe the entire database.",
    },
    {
      pattern: /DATABASE_URL\s*=\s*[^\s]*prod/i,
      permission: "deny",
      reason:
        "Command references a production DATABASE_URL. Never run destructive migrations against prod from the local environment.",
    },
    {
      pattern: /\bTRUNCATE\b/i,
      permission: "deny",
      reason:
        "TRUNCATE deletes every row in a table. Forbidden via the Agent.",
    },
    {
      pattern: /\bDELETE\s+FROM\b/i,
      permission: "ask",
      reason: "DELETE FROM can delete many rows at once.",
    },
    {
      pattern: /docker\s+compose\s+down\b[\s\S]{0,80}-v\b/i,
      permission: "deny",
      reason:
        "docker compose down -v removes volumes and can delete persisted data.",
    },
    {
      pattern: /docker(-compose)?\s+[\s\S]{0,80}\bvolume\s+rm\b/i,
      permission: "deny",
      reason: "Removing a Docker volume can delete database data.",
    },
    {
      pattern: /\b(rm|del)\b[\s\S]{0,120}\b[\w./\\-]+\.db\b/i,
      permission: "deny",
      reason: "Removing a .db file deletes the SQLite database. Forbidden via the Agent.",
    },
    {
      pattern: /Remove-Item[\s\S]{0,200}\.db\b/i,
      permission: "deny",
      reason:
        "Remove-Item on a .db file deletes the SQLite database. Forbidden via the Agent.",
    },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(normalized)) {
      respond(rule.permission, { command: normalized, tool, reason: rule.reason }, rule.reason);
    }
  }

  respond("allow", { command: normalized, tool, reason: null }, null);
} catch (error) {
  // Unexpected failure in the hook itself: fail closed to "deny", never a
  // silent "allow" (equivalent to Cursor's failClosed).
  logInvocation({ permission: "deny", commandPreview: null, tool: null, reason: `hook error: ${String(error)}` });
  process.stderr.write(`block-destructive-db hook failed: ${String(error)}\n`);
  process.stdout.write(
    JSON.stringify({
      systemMessage: "The database safety hook failed — blocking as a precaution.",
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Internal error in the blocking hook: ${String(error)}`,
      },
    }),
  );
  process.exit(2);
}
