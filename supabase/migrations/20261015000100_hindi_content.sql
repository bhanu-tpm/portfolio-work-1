-- Optional Hindi versions of admin-authored public content. When a Hindi field is
-- empty, the public site falls back to the English value. Existing grants and RLS
-- policies are table-wide, so the new columns inherit them.

alter table public.consultation_categories
  add column title_hi text check (char_length(title_hi) <= 120),
  add column short_description_hi text check (char_length(short_description_hi) <= 400),
  add column scope_hi text check (char_length(scope_hi) <= 2000);
-- Intake questions keep their Hindi label inside the existing JSON items as "label_hi".

alter table public.site_profile
  add column headline_hi text check (char_length(headline_hi) <= 200),
  add column short_bio_hi text check (char_length(short_bio_hi) <= 600),
  add column long_bio_hi text check (char_length(long_bio_hi) <= 6000),
  add column approach_hi text check (char_length(approach_hi) <= 3000),
  add column location_hi text check (char_length(location_hi) <= 120),
  add column credibility_points_hi jsonb not null default '[]'::jsonb
    check (jsonb_typeof(credibility_points_hi) = 'array');

alter table public.portfolio_items
  add column title_hi text check (char_length(title_hi) <= 200),
  add column subtitle_hi text check (char_length(subtitle_hi) <= 200),
  add column description_hi text check (char_length(description_hi) <= 2000),
  add column period_hi text check (char_length(period_hi) <= 80);

alter table public.blog_posts
  add column title_hi text check (char_length(title_hi) <= 200),
  add column excerpt_hi text check (char_length(excerpt_hi) <= 500),
  add column content_hi text check (char_length(content_hi) <= 100000),
  add column seo_title_hi text check (char_length(seo_title_hi) <= 70),
  add column seo_description_hi text check (char_length(seo_description_hi) <= 170),
  add column cover_image_alt_hi text check (char_length(cover_image_alt_hi) <= 200);

alter table public.blog_categories
  add column name_hi text check (char_length(name_hi) <= 80);

alter table public.blog_tags
  add column name_hi text check (char_length(name_hi) <= 60);
