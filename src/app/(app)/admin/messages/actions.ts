"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { UserFacingError, failure, formValues, type ActionState } from "@/lib/action-result";
import { idSchema, toggleSchema } from "@/lib/validation/content";

export async function setMessageHandled(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = toggleSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contact_messages")
      .update({ handled: parsed.data.value })
      .eq("id", parsed.data.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new UserFacingError("This message no longer exists.");
    await audit(user.id, parsed.data.value ? "contact_message.handled" : "contact_message.reopened", "contact_message", data.id);
    revalidatePath("/admin/messages");
    return { ok: true, message: parsed.data.value ? "Marked as handled." : "Marked as not handled." };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = idSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Invalid message." };
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contact_messages")
      .delete()
      .eq("id", parsed.data.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new UserFacingError("This message no longer exists.");
    // No message content in the audit log (personal data).
    await audit(user.id, "contact_message.deleted", "contact_message", data.id);
    revalidatePath("/admin/messages");
    return { ok: true, message: "Message deleted." };
  } catch (err) {
    return failure(err);
  }
}
