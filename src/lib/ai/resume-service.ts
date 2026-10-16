import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { UserFacingError } from "@/lib/action-result";
import { removeObjects } from "@/lib/storage";

/** Extracts plain text from a text-based PDF. Scanned PDFs yield little or no text. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    // pdf.js may transfer/detach the buffer, so give it a copy.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  } catch (err) {
    console.error("[resume] PDF text extraction failed", err instanceof Error ? err.message : err);
    throw new UserFacingError(
      "We couldn't read this PDF. It may be password-protected or damaged — please try another file or paste the text instead.",
    );
  }
}

/** Has the user reached the daily resume-review limit? Checked before uploading anything. */
export async function resumeReviewsInLastDay(userId: string) {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await createAdminClient()
    .from("resume_reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  return count ?? 0;
}

/** Removes a stored resume file (object + metadata). Caller must have checked ownership. */
export async function removeResumeFile(fileId: string, ownerId: string) {
  const admin = createAdminClient();
  const { data: file } = await admin
    .from("files")
    .select("id, bucket, path")
    .eq("id", fileId)
    .eq("owner_id", ownerId)
    .eq("purpose", "resume")
    .maybeSingle<{ id: string; bucket: string; path: string }>();
  if (!file) return;
  await removeObjects(file.bucket, [file.path]);
  await admin.from("files").delete().eq("id", file.id);
}

/**
 * Deletes the user's resume reviews (all, or the given ids) together with their
 * uploaded files. Ownership is enforced by reading through the user's RLS client
 * and filtering on user_id.
 */
export async function deleteResumeReviews(userId: string, ids?: string[]) {
  const supabase = await createClient();
  let query = supabase.from("resume_reviews").select("id, file_id").eq("user_id", userId);
  if (ids) query = query.in("id", ids);
  const { data } = await query;
  const reviews = (data ?? []) as { id: string; file_id: string | null }[];
  if (reviews.length === 0) return 0;

  const { error } = await supabase
    .from("resume_reviews")
    .delete()
    .eq("user_id", userId)
    .in(
      "id",
      reviews.map((r) => r.id),
    );
  if (error) throw error;

  for (const r of reviews) {
    if (r.file_id) await removeResumeFile(r.file_id, userId);
  }
  return reviews.length;
}
