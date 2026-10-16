-- Starter content. Everything here is placeholder text meant to be replaced from the
-- admin dashboard. It intentionally contains no experience, credentials, testimonials
-- or achievements.

insert into public.site_profile (id, full_name, headline, short_bio, long_bio, approach, contact_email, location, credibility_points)
values (
  1,
  'Your Name',
  'Career and education consultant for students and early-career professionals',
  'I help students, graduates and early-career professionals make clearer decisions about their studies, skills and careers.',
  'Replace this biography from Admin → Portfolio. Describe your background, the people you work with and why you started offering consultations.',
  'Every consultation starts with listening. We clarify your situation and goals, look at realistic options together, and finish with a written, practical action plan that you own.',
  'hello@example.com',
  'India (online consultations)',
  '[]'::jsonb
)
on conflict (id) do nothing;

-- Hindi versions (wording from hindi_website_localization_review.xlsx). Requires migration 20261015000100.
update public.site_profile set
  headline_hi = 'करियर और शिक्षा सलाहकार',
  short_bio_hi = 'विद्यार्थियों, हाल ही में स्नातक हुए युवाओं और करियर की शुरुआत कर रहे पेशेवरों के लिए व्यक्तिगत मार्गदर्शन।',
  approach_hi = 'हर परामर्श की शुरुआत आपकी बात ध्यान से सुनने से होती है। अंत में आपको एक व्यावहारिक लिखित योजना मिलती है, जो आपकी ज़रूरतों के अनुसार तैयार की जाती है।',
  location_hi = 'भारत (ऑनलाइन परामर्श)'
where id = 1 and headline_hi is null;

insert into public.portfolio_items (kind, title, description, sort_order) values
  ('expertise', 'Career planning', 'Exploring career paths and turning interests into a concrete plan.', 1),
  ('expertise', 'Higher education choices', 'Comparing degrees, specialisations and study options.', 2),
  ('expertise', 'Skills development', 'Identifying the skills that matter for a target role and how to build them.', 3),
  ('expertise', 'Resumes and professional profiles', 'Presenting your experience clearly and honestly.', 4);

insert into public.consultation_categories
  (slug, title, short_description, scope, formats, duration_minutes, intake_questions, resume_review_enabled, sort_order)
values
  ('career-planning', 'Career Planning and Direction',
   'Clarify where you want to go and map realistic paths to get there.',
   'Interests and strengths discussion, exploration of 2–4 career paths, and a written action plan.',
   array['video', 'phone'], 60,
   '[{"id":"interests","label":"Which subjects or activities do you enjoy most?","type":"textarea","required":true},
     {"id":"paths","label":"Which careers are you currently considering, if any?","type":"textarea","required":false}]'::jsonb,
   false, 1),
  ('higher-education', 'Higher Education and Academic Decisions',
   'Decide between degrees, specialisations, universities or a gap year.',
   'Review of your options, decision criteria, timelines and next steps for applications.',
   array['video', 'phone'], 60,
   '[{"id":"options","label":"Which programmes or institutions are you comparing?","type":"textarea","required":true},
     {"id":"timeline","label":"When do you need to make the decision?","type":"text","required":false}]'::jsonb,
   false, 2),
  ('skills-development', 'Skills and Professional Development',
   'Identify the skills that matter for your goals and plan how to build them.',
   'Skills gap discussion, learning plan with milestones, and recommended resources to evaluate.',
   array['video', 'phone'], 45,
   '[{"id":"target","label":"Which role or field are you building skills for?","type":"text","required":true}]'::jsonb,
   false, 3),
  ('resume-guidance', 'Resume and Professional Profile Guidance',
   'Present your experience clearly on your resume and professional profiles.',
   'Structured resume feedback, profile improvements and guidance on tailoring for roles.',
   array['video', 'phone'], 45,
   '[{"id":"target_role","label":"Which role are you applying for?","type":"text","required":true}]'::jsonb,
   true, 4),
  ('job-search-transition', 'Job Search and Career Transition',
   'Plan your job search or a move into a new field.',
   'Search strategy, transferable skills, positioning and a weekly plan.',
   array['video', 'phone'], 60,
   '[{"id":"current_role","label":"What is your current role or situation?","type":"text","required":true},
     {"id":"target_field","label":"Which field or role do you want to move into?","type":"text","required":true}]'::jsonb,
   true, 5),
  ('general', 'General Career Consultation',
   'Not sure where your question fits? Start here.',
   'An open conversation about your situation followed by recommended next steps.',
   array['video', 'phone'], 45, '[]'::jsonb, false, 6);

-- Weekday availability in Asia/Kolkata local time (Mon–Fri, 10:00–13:00 and 14:00–18:00).
insert into public.availability_rules (weekday, start_time, end_time)
select d, s, e
from generate_series(1, 5) as d,
     (values ('10:00'::time, '13:00'::time), ('14:00'::time, '18:00'::time)) as w(s, e);

insert into public.blog_categories (slug, name) values
  ('career-planning', 'Career planning'),
  ('higher-education', 'Higher education'),
  ('skills', 'Skills');

insert into public.blog_tags (slug, name) values
  ('students', 'Students'), ('decision-making', 'Decision making'), ('resumes', 'Resumes');

insert into public.blog_posts (slug, title, excerpt, content, category_id, status, published_at, reading_minutes)
values
  ('how-to-prepare-for-a-career-consultation',
   'How to prepare for a career consultation',
   'A short checklist to help you get the most out of a consultation session.',
   E'*Sample article — replace or delete it from Admin → Blog.*\n\n## Before the session\n\n- Write down the decision you are trying to make.\n- List the options you are already considering, even if they feel unrealistic.\n- Note any constraints: time, location, budget, family expectations.\n\n## During the session\n\nBe honest about what you enjoy and what you avoid. There are no wrong answers.\n\n## After the session\n\nPick one action from your plan and do it within a week. Momentum matters more than perfection.',
   (select id from public.blog_categories where slug = 'career-planning'),
   'published', now() - interval '3 days', 2),
  ('comparing-study-options-a-simple-framework',
   'Comparing study options: a simple framework',
   'Use a small set of criteria to compare degrees and specialisations side by side.',
   E'*Sample article — replace or delete it from Admin → Blog.*\n\n## Pick your criteria\n\nChoose four to six criteria that matter to you, such as curriculum, cost, location, flexibility and the kinds of roles graduates go on to.\n\n## Score honestly\n\nRate each option from 1 to 5 on each criterion and note where you are guessing. Guesses are research tasks, not answers.\n\n## Verify with official sources\n\nAdmission requirements, fees and accreditation change. Always confirm them on the institution''s official website.',
   (select id from public.blog_categories where slug = 'higher-education'),
   'published', now() - interval '1 day', 3);

insert into public.blog_post_tags (post_id, tag_id)
select p.id, t.id from public.blog_posts p, public.blog_tags t
where (p.slug = 'how-to-prepare-for-a-career-consultation' and t.slug in ('students', 'decision-making'))
   or (p.slug = 'comparing-study-options-a-simple-framework' and t.slug in ('students', 'decision-making'));
