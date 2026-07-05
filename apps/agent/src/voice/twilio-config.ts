/** Twilio + public URL configuration helpers (never log secrets). */

export interface TwilioConfig {
  accountSid: string | undefined;
  authToken: string | undefined;
  phoneNumber: string | undefined;
  publicAgentUrl: string | undefined;
  shipperPhone: string | undefined;
  geminiLiveModel: string;
}

export function getTwilioConfig(): TwilioConfig {
  const rawPublic = process.env.PUBLIC_AGENT_URL?.trim();
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID?.trim(),
    authToken: process.env.TWILIO_AUTH_TOKEN?.trim(),
    phoneNumber: process.env.TWILIO_PHONE_NUMBER?.trim(),
    publicAgentUrl: rawPublic ? rawPublic.replace(/\/$/, "") : undefined,
    shipperPhone: process.env.SHIPPER_PHONE_NUMBER?.trim(),
    geminiLiveModel:
      process.env.GEMINI_LIVE_MODEL ?? "gemini-2.5-flash-native-audio-preview-12-2025",
  };
}

export function isTwilioConfigured(): boolean {
  const c = getTwilioConfig();
  return !!(c.accountSid && c.authToken && c.phoneNumber && c.publicAgentUrl);
}

export function isTwilioPartiallyConfigured(): boolean {
  const c = getTwilioConfig();
  return !!(c.accountSid || c.authToken || c.phoneNumber || c.publicAgentUrl);
}

/** Convert https://host → wss://host/twilio/stream */
export function buildStreamWssUrl(publicAgentUrl: string): string {
  const base = publicAgentUrl.replace(/\/$/, "");
  const wsBase = base.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  return `${wsBase}/twilio/stream`;
}

export interface TwilioStatusCheck {
  ok: boolean;
  configured: boolean;
  geminiAvailable: boolean;
  checks: Record<string, boolean>;
  missing: string[];
  streamWssUrl?: string;
  setupHint: string;
}

export function checkTwilioStatus(geminiAvailable: boolean): TwilioStatusCheck {
  const c = getTwilioConfig();
  const checks = {
    TWILIO_ACCOUNT_SID: !!c.accountSid,
    TWILIO_AUTH_TOKEN: !!c.authToken,
    TWILIO_PHONE_NUMBER: !!c.phoneNumber,
    PUBLIC_AGENT_URL: !!c.publicAgentUrl,
    GEMINI_API_KEY: geminiAvailable,
  };
  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);
  const configured = isTwilioConfigured() && geminiAvailable;
  return {
    ok: configured,
    configured: isTwilioConfigured(),
    geminiAvailable,
    checks,
    missing,
    streamWssUrl: c.publicAgentUrl ? buildStreamWssUrl(c.publicAgentUrl) : undefined,
    setupHint: configured
      ? "Twilio + Gemini Live telephony ready."
      : "Set missing env vars in .env — see README § Twilio PSTN voice.",
  };
}

export function printTwilioSetupInstructions(): void {
  console.log(`
[twilio] PSTN voice not fully configured. To enable real phone calls:

  1. Copy .env.example → .env and fill:
     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
     PUBLIC_AGENT_URL (ngrok HTTPS URL, no trailing slash)
     SHIPPER_PHONE_NUMBER (verified on Twilio trial for outbound)
     VOICE_MODE=twilio

  2. Expose agent:  ngrok http 8787
     Set PUBLIC_AGENT_URL=https://YOUR_SUBDOMAIN.ngrok-free.app

  3. Twilio Console → Phone Numbers → your number → Voice:
     "A call comes in" → Webhook POST → \${PUBLIC_AGENT_URL}/twilio/voice

  4. Inbound test: dial your Twilio number from your phone.
     Outbound test: submit a case with VOICE_MODE=twilio.

  Validate: pnpm --filter @clearborder/agent exec tsx ../../scripts/test-twilio-config.ts
`);
}
