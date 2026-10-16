import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/** Records an administrative or security-relevant action. Never throws. */
export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    const { error } = await createAdminClient()
      .from("audit_logs")
      .insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, metadata });
    if (error) console.error("[audit] insert failed", error.message);
  } catch (err) {
    console.error("[audit] unavailable", err);
  }
}
