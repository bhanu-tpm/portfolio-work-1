import "server-only";
import { updateTag } from "next/cache";
import { TAGS } from "@/lib/content";

/** Call from admin Server Actions after changing public content. */
export function refreshPublicContent(...keys: (keyof typeof TAGS)[]) {
  for (const key of keys) updateTag(TAGS[key]);
}
