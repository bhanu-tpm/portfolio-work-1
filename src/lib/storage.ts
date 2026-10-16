import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { UserFacingError } from "@/lib/action-result";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // keep below serverless body limits

export const BUCKETS = {
  requestFiles: "request-files",
  outcomeDocuments: "outcome-documents",
  resumes: "resumes",
  publicMedia: "public-media",
} as const;

type Kind = "pdf" | "png" | "jpeg" | "webp" | "docx";

const MIME_BY_KIND: Record<Kind, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Identify the file from its magic bytes rather than trusting the browser-supplied type. */
export function sniffKind(bytes: Uint8Array): Kind | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (starts([0xff, 0xd8, 0xff])) return "jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (starts([0x50, 0x4b, 0x03, 0x04])) return "docx"; // ZIP container; extension checked separately
  return null;
}

export interface ValidatedFile {
  bytes: Uint8Array;
  mimeType: string;
  originalName: string;
  size: number;
  kind: Kind;
}

export async function validateUpload(file: File, allowed: Kind[]): Promise<ValidatedFile> {
  if (file.size === 0) throw new UserFacingError(`"${file.name}" is empty.`);
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UserFacingError(`"${file.name}" is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffKind(bytes);
  if (!kind || !allowed.includes(kind) || (kind === "docx" && !/\.docx$/i.test(file.name))) {
    throw new UserFacingError(`"${file.name}" is not an allowed file type.`);
  }
  const originalName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 200) || "file";
  return { bytes, mimeType: MIME_BY_KIND[kind], originalName, size: file.size, kind };
}

export function buildObjectPath(ownerId: string, scope: string, originalName: string) {
  const ext = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase().slice(0, 8) : "bin";
  return `${ownerId}/${scope}/${randomUUID()}.${ext}`;
}

export async function uploadObject(bucket: string, path: string, file: ValidatedFile) {
  const { error } = await createAdminClient()
    .storage.from(bucket)
    .upload(path, file.bytes, { contentType: file.mimeType, upsert: false });
  if (error) {
    console.error("[storage] upload failed", error.message);
    throw new UserFacingError("The file could not be uploaded. Please try again.");
  }
}

export async function removeObjects(bucket: string, paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await createAdminClient().storage.from(bucket).remove(paths);
  if (error) console.error("[storage] remove failed", error.message);
}

/** Short-lived signed URL. Callers must authorize before calling this. */
export async function signedDownloadUrl(bucket: string, path: string, downloadName: string, expiresIn = 60) {
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrl(path, expiresIn, { download: downloadName });
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
  return data.signedUrl;
}

export function publicObjectUrl(bucket: string, path: string) {
  return createAdminClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
