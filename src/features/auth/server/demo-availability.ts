import "server-only";

export function demoLoginAvailable() {
  return process.env.BANORTE_DEMO_LOGIN_ENABLED === "true"
    && Boolean(process.env.BANORTE_DEMO_EMAIL?.trim())
    && Boolean(process.env.BANORTE_DEMO_PASSWORD);
}
