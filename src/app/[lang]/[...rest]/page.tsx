import { notFound } from "next/navigation";

/** Any unmatched public URL renders the localised 404 inside the site layout. */
export default function CatchAll() {
  notFound();
}
