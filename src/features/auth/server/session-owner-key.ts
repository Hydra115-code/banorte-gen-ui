import "server-only";

import { createHash } from "node:crypto";

export function sessionOwnerKey(userId: string) {
  return createHash("sha256").update(`banorte-session-owner:${userId}`).digest("hex");
}
