import "server-only";
import { BUCKETS, buildObjectPath, publicObjectUrl, removeObjects, uploadObject, validateUpload } from "@/lib/storage";
import { publicObjectPath } from "@/lib/validation/content";

/** Returns the uploaded File from a form field, or null when nothing was chosen. */
export function formFile(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

/** Validates (magic bytes) and uploads an image to the public-media bucket. */
export async function uploadPublicImage(file: File, ownerId: string, scope: "blog" | "profile") {
  const validated = await validateUpload(file, ["png", "jpeg", "webp"]);
  const path = buildObjectPath(ownerId, scope, validated.originalName);
  await uploadObject(BUCKETS.publicMedia, path, validated);
  return { path, url: publicObjectUrl(BUCKETS.publicMedia, path) };
}

/** Object path for a URL that points into our public-media bucket, otherwise null. */
export function ownedPublicMediaPath(url: string | null | undefined) {
  if (!url) return null;
  const prefix = publicObjectUrl(BUCKETS.publicMedia, "");
  return publicObjectPath(url, prefix);
}

/** Best-effort removal of a replaced/deleted public image (never throws). */
export async function removePublicImage(url: string | null | undefined) {
  const path = ownedPublicMediaPath(url);
  if (path) await removeObjects(BUCKETS.publicMedia, [path]);
}
