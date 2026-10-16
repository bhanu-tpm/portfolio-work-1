import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import type {
  BlogCategory,
  BlogPost,
  BlogTag,
  ConsultationCategory,
  PortfolioItem,
  SiteProfile,
} from "@/lib/db/types";

/** Cache tags invalidated by admin actions (updateTag). */
export const TAGS = {
  profile: "site-profile",
  portfolio: "portfolio",
  categories: "categories",
  posts: "posts",
} as const;

const FALLBACK_PROFILE: SiteProfile = {
  full_name: "Your Name",
  headline: "Career and education consultant",
  short_bio: "Personal guidance for students, graduates and early-career professionals.",
  long_bio: "",
  approach: "",
  photo_url: null,
  contact_email: null,
  contact_phone: null,
  location: null,
  social_links: [],
  credibility_points: [],
  headline_hi: "करियर और शिक्षा सलाहकार",
  short_bio_hi: "विद्यार्थियों, हाल ही में स्नातक हुए युवाओं और करियर की शुरुआत कर रहे पेशेवरों के लिए व्यक्तिगत मार्गदर्शन।",
};

// Public reads use an anonymous client (RLS: published/visible rows only) so
// results are safe to share across visitors and can live in the static shell.

export async function getSiteProfile(): Promise<SiteProfile> {
  "use cache";
  cacheTag(TAGS.profile);
  cacheLife("hours");
  const supabase = createPublicClient();
  if (!supabase) return FALLBACK_PROFILE;
  const { data, error } = await supabase.from("site_profile").select("*").eq("id", 1).maybeSingle();
  if (error) console.error("[content] site profile", error.message);
  return (data as SiteProfile | null) ?? FALLBACK_PROFILE;
}

export async function getPortfolioItems(): Promise<PortfolioItem[]> {
  "use cache";
  cacheTag(TAGS.portfolio);
  cacheLife("hours");
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("is_visible", true)
    .order("kind")
    .order("sort_order");
  if (error) console.error("[content] portfolio", error.message);
  return (data as PortfolioItem[] | null) ?? [];
}

export async function getActiveCategories(): Promise<ConsultationCategory[]> {
  "use cache";
  cacheTag(TAGS.categories);
  cacheLife("hours");
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("consultation_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) console.error("[content] categories", error.message);
  return (data as ConsultationCategory[] | null) ?? [];
}

export type PublicPost = Omit<BlogPost, "content" | "content_hi"> & {
  category: BlogCategory | null;
  tags: BlogTag[];
};

type PostRow = BlogPost & {
  category: BlogCategory | null;
  blog_post_tags: { tag: BlogTag | null }[];
};

const POST_SELECT =
  "id, slug, title, excerpt, cover_image_url, cover_image_alt, category_id, status, published_at, seo_title, seo_description, reading_minutes, created_at, updated_at, title_hi, excerpt_hi, seo_title_hi, seo_description_hi, cover_image_alt_hi, category:blog_categories(id, slug, name, name_hi), blog_post_tags(tag:blog_tags(id, slug, name, name_hi))";

function toPublicPost(row: PostRow): PublicPost {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { blog_post_tags, content: _content, content_hi: _contentHi, ...rest } = row;
  return { ...rest, tags: (blog_post_tags ?? []).map((t) => t.tag).filter((t): t is BlogTag => Boolean(t)) };
}

/** All published posts (newest first). Filtering/search happens in memory: the blog is small. */
export async function getPublishedPosts(): Promise<PublicPost[]> {
  "use cache";
  cacheTag(TAGS.posts);
  cacheLife("hours");
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) console.error("[content] posts", error.message);
  return ((data ?? []) as unknown as PostRow[]).map(toPublicPost);
}

export async function getPublishedPost(slug: string): Promise<(PublicPost & { content: string; content_hi: string | null }) | null> {
  "use cache";
  cacheTag(TAGS.posts);
  cacheLife("hours");
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("blog_posts")
    .select(`${POST_SELECT}, content, content_hi`)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) console.error("[content] post", error.message);
  if (!data) return null;
  const row = data as unknown as PostRow;
  return { ...toPublicPost(row), content: row.content, content_hi: row.content_hi ?? null };
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  "use cache";
  cacheTag(TAGS.posts);
  cacheLife("hours");
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase.from("blog_categories").select("id, slug, name, name_hi").order("name");
  return (data as BlogCategory[] | null) ?? [];
}

export function filterPosts(posts: PublicPost[], opts: { q?: string; category?: string; tag?: string }) {
  const q = opts.q?.trim().toLowerCase();
  return posts.filter((p) => {
    if (opts.category && p.category?.slug !== opts.category) return false;
    if (opts.tag && !p.tags.some((t) => t.slug === opts.tag)) return false;
    if (q && !`${p.title} ${p.excerpt} ${p.tags.map((t) => t.name).join(" ")}`.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}
