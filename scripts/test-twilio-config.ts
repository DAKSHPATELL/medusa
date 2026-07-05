#!/usr/bin/env tsx
/**
 * Validates Twilio + Gemini Live telephony env vars.
 * Run: pnpm test:twilio  (or tsx scripts/test-twilio-config.ts)
 */
import { loadRootEnv } from "../apps/agent/src/env";
import { getGemini } from "../apps/agent/src/gemini/client";
import { checkTwilioStatus, getTwilioConfig, isTwilioConfigured } from "../apps/agent/src/voice/twilio-config";

loadRootEnv();

const cfg = getTwilioConfig();
const geminiOk = !!getGemini();
const status = checkTwilioStatus(geminiOk);

console.log("\nClearBorder — Twilio PSTN configuration check\n");
console.log("Variables:");
for (const [key, ok] of Object.entries(status.checks)) {
  const mark = ok ? "✓" : "✗";
  const display =
    key.includes("TOKEN") || key.includes("KEY")
      ? ok
        ? "(set)"
        : "(missing)"
      : key === "TWILIO_ACCOUNT_SID"
        ? cfg.accountSid
          ? `${cfg.accountSid.slice(0, 6)}…`
          : "(missing)"
        : key === "TWILIO_PHONE_NUMBER"
          ? cfg.phoneNumber ?? "(missing)"
          : key === "PUBLIC_AGENT_URL"
            ? cfg.publicAgentUrl ?? "(missing)"
            : ok
              ? "ok"
              : "(missing)";
  console.log(`  ${mark} ${key}: ${display}`);
}

if (status.streamWssUrl) {
  console.log(`\nMedia Stream WSS: ${status.streamWssUrl}`);
}

console.log(`\nOverall: ${status.ok ? "READY for PSTN calls" : "NOT READY"}`);
if (!status.ok) {
  console.log(`\nMissing: ${status.missing.join(", ")}`);
  console.log(`\n${status.setupHint}`);
  console.log(`
Next steps:
  1. ngrok http 8787
  2. PUBLIC_AGENT_URL=https://YOUR.ngrok-free.app  (no trailing slash)
  3. Twilio Console → Phone Number → Voice → Webhook POST:
     \${PUBLIC_AGENT_URL}/twilio/voice
  4. Inbound test: dial ${cfg.phoneNumber ?? "your Twilio number"}
  5. Outbound test: VOICE_MODE=twilio + submit a case
`);
  process.exit(1);
}

if (!isTwilioConfigured()) {
  process.exit(1);
}

console.log("\nTwilio telephony configuration looks good.\n");
process.exit(0);
