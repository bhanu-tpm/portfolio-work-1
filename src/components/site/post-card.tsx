import Image from "next/image";
import Link from "next/link";
import type { PublicPost } from "@/lib/content";
import { DEFAULT_TIMEZONE, formatDate } from "@/lib/format";
import { localizePost } from "@/lib/localize";
import { LOCALE_TAGS, fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { shouldOptimize } from "@/lib/images";

export async function PostCard({ post: raw }: { post: PublicPost }) {
  const { locale, t, href } = await getI18n();
  const post = localizePost(raw, locale);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-sm">
      {post.cover_image_url ? (
        <Image
          src={post.cover_image_url}
          alt={post.cover_image_alt ?? ""}
          width={640}
          height={360}
          unoptimized={!shouldOptimize(post.cover_image_url)}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div aria-hidden className="aspect-video w-full bg-gradient-to-br from-secondary to-accent" />
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs text-muted-foreground">
          {post.category ? <span className="font-medium text-teal">{post.category.name} · </span> : null}
          <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at, DEFAULT_TIMEZONE, LOCALE_TAGS[locale])}</time> ·{" "}
          {fmt(t.common.readingTime, { n: post.reading_minutes })}
          {!post.translated ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5">{t.common.englishOnly}</span> : null}
        </p>
        <h3 className="mt-2 font-sans text-lg leading-snug font-semibold tracking-normal">
          <Link href={href(`/blog/${post.slug}`)} className="after:absolute after:inset-0 focus-visible:underline group-hover:underline">
            <span className="relative">{post.title}</span>
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
      </div>
    </article>
  );
}
