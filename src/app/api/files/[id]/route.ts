import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { signedDownloadUrl } from "@/lib/storage";
import { audit } from "@/lib/audit";
import type { FileRecord } from "@/lib/db/types";

/**
 * Download a request attachment or resume. Authorization is enforced twice:
 * explicitly here and by RLS on the `files` table (owner or admin only).
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: file } = await supabase.from("files").select("*").eq("id", id).maybeSingle<FileRecord>();
  const allowed =
    file && file.purpose !== "outcome_document" && (file.owner_id === user.id || user.isAdmin);
  if (!file || !allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.isAdmin && file.owner_id !== user.id) {
    await audit(user.id, "file.downloaded", "file", file.id, { purpose: file.purpose });
  }
  const url = await signedDownloadUrl(file.bucket, file.path, file.original_name);
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
