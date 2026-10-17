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
  (slug, title, title_hi, short_description, short_description_hi, scope, scope_hi, formats, duration_minutes,
   intake_questions, resume_review_enabled, sort_order)
values
  ('career-planning', 'Career Planning and Direction', 'करियर योजना और दिशा',
   'Clarify where you want to go and map realistic paths to get there.',
   'तय करें कि आप कहाँ पहुँचना चाहते हैं, और वहाँ तक पहुँचने के व्यावहारिक रास्ते बनाएँ।',
   'Interests and strengths discussion, exploration of 2–4 career paths, and a written action plan.',
   'रुचियों और खूबियों पर चर्चा, 2–4 करियर विकल्पों की पड़ताल, और एक लिखित कार्य-योजना।',
   array['video', 'phone'], 60,
   '[{"id": "interests", "label": "Which subjects or activities do you enjoy most?", "label_hi": "आपको कौन-से विषय या गतिविधियाँ सबसे ज़्यादा पसंद हैं?", "type": "textarea", "required": true}, {"id": "paths", "label": "Which careers are you currently considering, if any?", "label_hi": "अभी आप किन करियर विकल्पों के बारे में सोच रहे हैं, अगर कोई है?", "type": "textarea", "required": false}]'::jsonb,
   false, 1),
  ('stream-selection', 'Stream and Subject Selection (after Class 10 or 12)', 'स्ट्रीम और विषय का चुनाव (10वीं या 12वीं के बाद)',
   'Choose between Science, Commerce and Arts, or pick the right subjects and course after Class 12.',
   'साइंस, कॉमर्स और आर्ट्स में से चुनें, या 12वीं के बाद सही विषय और कोर्स तय करें।',
   'A look at the student''s interests, strengths and marks, what each stream leads to, and a clear recommendation with next steps. Parents are welcome to join.',
   'छात्र की रुचियों, खूबियों और अंकों पर बात, हर स्ट्रीम से आगे कौन-से रास्ते खुलते हैं, और अगले कदमों के साथ एक स्पष्ट सुझाव। माता-पिता भी साथ जुड़ सकते हैं।',
   array['video', 'phone'], 60,
   '[{"id": "current_class", "label": "Which class is the student in, and which board (CBSE, ICSE, state board)?", "label_hi": "छात्र किस कक्षा में है, और कौन-सा बोर्ड है (CBSE, ICSE, राज्य बोर्ड)?", "type": "text", "required": true}, {"id": "subjects", "label": "Which subjects does the student enjoy and do well in?", "label_hi": "छात्र को कौन-से विषय पसंद हैं और किनमें वह अच्छा करता/करती है?", "type": "textarea", "required": true}, {"id": "options", "label": "Which streams or courses are you considering?", "label_hi": "आप किन स्ट्रीम या कोर्स के बारे में सोच रहे हैं?", "type": "textarea", "required": false}]'::jsonb,
   false, 2),
  ('entrance-exams-colleges', 'Entrance Exams and College Shortlisting', 'प्रवेश परीक्षाएँ और कॉलेजों की शॉर्टलिस्ट',
   'Work out which entrance exams suit you and build a realistic shortlist of colleges.',
   'पता करें कि कौन-सी प्रवेश परीक्षाएँ आपके लिए सही हैं, और कॉलेजों की एक व्यावहारिक सूची बनाएँ।',
   'Which exams fit your goals (for example JEE, NEET, CUET or CLAT), key dates to track, a shortlist of colleges by fit, and how to approach counselling and choice filling. Admission decisions rest with the institutions.',
   'आपके लक्ष्यों के लिए कौन-सी परीक्षाएँ सही हैं (जैसे JEE, NEET, CUET या CLAT), ध्यान रखने वाली ज़रूरी तारीख़ें, उपयुक्तता के आधार पर कॉलेजों की सूची, और काउंसलिंग व चॉइस फ़िलिंग की तैयारी। दाख़िले का फ़ैसला संस्थान ही करते हैं।',
   array['video', 'phone'], 60,
   '[{"id": "goal", "label": "Which course or field do you want to get into?", "label_hi": "आप किस कोर्स या क्षेत्र में दाख़िला लेना चाहते हैं?", "type": "text", "required": true}, {"id": "exams", "label": "Which entrance exams have you taken or plan to take, with scores or ranks if available?", "label_hi": "आपने कौन-सी प्रवेश परीक्षाएँ दी हैं या देने वाले हैं? अगर हों तो अंक या रैंक भी बताएँ।", "type": "textarea", "required": true}, {"id": "preferences", "label": "Any preferences on location, budget or type of college?", "label_hi": "जगह, बजट या कॉलेज के प्रकार को लेकर आपकी कोई पसंद?", "type": "textarea", "required": false}]'::jsonb,
   false, 3),
  ('higher-education', 'Higher Education and Academic Decisions', 'उच्च शिक्षा और पढ़ाई से जुड़े फ़ैसले',
   'Decide between degrees, specialisations, universities or a gap year.',
   'डिग्री, स्पेशलाइज़ेशन, विश्वविद्यालय या गैप ईयर के बीच फ़ैसला करें।',
   'Review of your options, decision criteria, timelines and next steps for applications.',
   'आपके विकल्पों की समीक्षा, फ़ैसले के आधार, समय-सीमा और आवेदन के अगले कदम।',
   array['video', 'phone'], 60,
   '[{"id": "options", "label": "Which programmes or institutions are you comparing?", "label_hi": "आप किन कोर्स या संस्थानों की तुलना कर रहे हैं?", "type": "textarea", "required": true}, {"id": "timeline", "label": "When do you need to make the decision?", "label_hi": "आपको यह फ़ैसला कब तक करना है?", "type": "text", "required": false}]'::jsonb,
   false, 4),
  ('resume-guidance', 'Resume, Cover Letter and LinkedIn Profile', 'रिज़्यूमे, कवर लेटर और LinkedIn प्रोफ़ाइल',
   'Get a clear, honest resume and cover letter written or rewritten, and a stronger LinkedIn profile.',
   'एक स्पष्ट और सच्चा रिज़्यूमे व कवर लेटर लिखवाएँ या दोबारा लिखवाएँ, और अपनी LinkedIn प्रोफ़ाइल बेहतर बनाएँ।',
   'A conversation about your experience and target roles, then a written or rewritten resume and cover letter based only on what you have actually done, plus LinkedIn profile improvements and tips for tailoring each application.',
   'आपके अनुभव और लक्षित भूमिकाओं पर बातचीत, फिर केवल आपके असल काम के आधार पर लिखा गया या दोबारा लिखा गया रिज़्यूमे और कवर लेटर, साथ में LinkedIn प्रोफ़ाइल में सुधार और हर आवेदन के हिसाब से बदलाव के सुझाव।',
   array['video', 'phone'], 60,
   '[{"id": "target_role", "label": "Which role or kind of job are you applying for?", "label_hi": "आप किस भूमिका या किस तरह की नौकरी के लिए आवेदन कर रहे हैं?", "type": "text", "required": true}, {"id": "documents", "label": "What do you need: resume, cover letter, LinkedIn profile, or all three?", "label_hi": "आपको क्या चाहिए: रिज़्यूमे, कवर लेटर, LinkedIn प्रोफ़ाइल, या तीनों?", "type": "text", "required": true}, {"id": "experience", "label": "Briefly describe your education and experience so far.", "label_hi": "अब तक की अपनी पढ़ाई और अनुभव के बारे में संक्षेप में बताएँ।", "type": "textarea", "required": false}]'::jsonb,
   true, 5),
  ('interview-preparation', 'Interview Preparation and Mock Interviews', 'इंटरव्यू की तैयारी और मॉक इंटरव्यू',
   'Practise with a realistic mock interview and get specific feedback before the real one.',
   'असली इंटरव्यू से पहले एक वास्तविक जैसा मॉक इंटरव्यू दें और ठोस फ़ीडबैक पाएँ।',
   'Common and role-specific questions, a mock interview over video, feedback on your answers and body language, and a short list of what to improve. Suitable for jobs, internships and college admission interviews.',
   'आम और भूमिका से जुड़े सवाल, वीडियो पर मॉक इंटरव्यू, आपके जवाबों और हाव-भाव पर फ़ीडबैक, और सुधार की एक छोटी सूची। नौकरी, इंटर्नशिप और कॉलेज दाख़िले के इंटरव्यू के लिए उपयुक्त।',
   array['video', 'phone'], 60,
   '[{"id": "interview_for", "label": "What is the interview for (role, company or college)?", "label_hi": "इंटरव्यू किसके लिए है (भूमिका, कंपनी या कॉलेज)?", "type": "text", "required": true}, {"id": "interview_date", "label": "When is the interview, if you know?", "label_hi": "इंटरव्यू कब है, अगर पता हो?", "type": "text", "required": false}, {"id": "worries", "label": "Which parts of the interview worry you most?", "label_hi": "इंटरव्यू का कौन-सा हिस्सा आपको सबसे ज़्यादा चिंता में डालता है?", "type": "textarea", "required": false}]'::jsonb,
   false, 6),
  ('job-search-transition', 'Job Search and Career Change', 'नौकरी की तलाश और करियर बदलाव',
   'Plan your job search, or a move into a new field after some years of work.',
   'नौकरी की तलाश की योजना बनाएँ, या कुछ साल काम करने के बाद नए क्षेत्र में जाने की।',
   'Search strategy, transferable skills, how to position your experience for a new field, and a weekly plan. Especially useful for working professionals considering a change.',
   'तलाश की रणनीति, दूसरे क्षेत्र में काम आने वाले कौशल, नए क्षेत्र के लिए अपने अनुभव को कैसे पेश करें, और एक साप्ताहिक योजना। करियर बदलने की सोच रहे कामकाजी लोगों के लिए ख़ास तौर पर उपयोगी।',
   array['video', 'phone'], 60,
   '[{"id": "current_role", "label": "What is your current role or situation?", "label_hi": "आपकी मौजूदा भूमिका या स्थिति क्या है?", "type": "text", "required": true}, {"id": "target_field", "label": "Which field or role do you want to move into?", "label_hi": "आप किस क्षेत्र या भूमिका में जाना चाहते हैं?", "type": "text", "required": true}]'::jsonb,
   true, 7),
  ('internship-first-job', 'Internships and Your First Job', 'इंटर्नशिप और पहली नौकरी',
   'Find and apply for internships and entry-level roles with a clear plan.',
   'एक स्पष्ट योजना के साथ इंटर्नशिप और शुरुआती नौकरियाँ ढूँढें और उनके लिए आवेदन करें।',
   'Where to look, how to apply, how to reach out to people in your field, and how to make the most of campus placements, followed by a simple application plan.',
   'कहाँ ढूँढें, कैसे आवेदन करें, अपने क्षेत्र के लोगों से कैसे संपर्क करें, और कैंपस प्लेसमेंट का पूरा फ़ायदा कैसे उठाएँ, और फिर आवेदन की एक आसान योजना।',
   array['video', 'phone'], 45,
   '[{"id": "course_year", "label": "Which course and year are you in, or when did you graduate?", "label_hi": "आप किस कोर्स और साल में हैं, या आपने पढ़ाई कब पूरी की?", "type": "text", "required": true}, {"id": "target", "label": "What kind of internship or job are you looking for?", "label_hi": "आप किस तरह की इंटर्नशिप या नौकरी ढूँढ रहे हैं?", "type": "textarea", "required": true}]'::jsonb,
   true, 8),
  ('study-abroad', 'Study Abroad Planning and SOP Review', 'विदेश में पढ़ाई की योजना और SOP समीक्षा',
   'Plan studying abroad: country, course, timeline, and feedback on your statement of purpose.',
   'विदेश में पढ़ाई की योजना: देश, कोर्स, समय-सीमा, और आपके स्टेटमेंट ऑफ़ पर्पस पर फ़ीडबैक।',
   'Comparing countries and courses against your goals and budget, an application timeline, and detailed feedback on your SOP and LOR drafts. Your SOP stays your own writing; university and visa decisions rest with the authorities.',
   'आपके लक्ष्यों और बजट के हिसाब से देशों और कोर्स की तुलना, आवेदन की समय-सीमा, और आपके SOP और LOR के मसौदों पर विस्तृत फ़ीडबैक। SOP आपका अपना लिखा हुआ ही रहता है; विश्वविद्यालय और वीज़ा के फ़ैसले संबंधित अधिकारी करते हैं।',
   array['video', 'phone'], 60,
   '[{"id": "plan", "label": "Which course and countries are you considering, and for which intake?", "label_hi": "आप कौन-सा कोर्स और कौन-से देश सोच रहे हैं, और किस इनटेक के लिए?", "type": "textarea", "required": true}, {"id": "budget", "label": "What is your approximate budget, and will you need a loan or scholarship?", "label_hi": "आपका अनुमानित बजट क्या है, और क्या आपको लोन या छात्रवृत्ति की ज़रूरत होगी?", "type": "text", "required": false}]'::jsonb,
   false, 9),
  ('project-guidance', 'College Project Guidance and Mentoring', 'कॉलेज प्रोजेक्ट मार्गदर्शन और मेंटरिंग',
   'Get help choosing, planning and improving your college project, while the work stays your own.',
   'अपने कॉलेज प्रोजेक्ट को चुनने, उसकी योजना बनाने और उसे बेहतर करने में मदद पाएँ, जबकि काम आपका अपना ही रहे।',
   'Choosing and scoping a topic, planning the method and timeline, feedback on your drafts, and preparation for the presentation or viva. Projects are not written for students, in line with academic integrity rules.',
   'विषय चुनना और उसका दायरा तय करना, तरीक़े और समय-सीमा की योजना, आपके मसौदों पर फ़ीडबैक, और प्रेज़ेंटेशन या वाइवा की तैयारी। शैक्षणिक ईमानदारी के नियमों के अनुसार, छात्रों के लिए प्रोजेक्ट लिखे नहीं जाते।',
   array['video', 'phone'], 45,
   '[{"id": "project", "label": "Which course is the project for, and what is the topic or idea so far?", "label_hi": "प्रोजेक्ट किस कोर्स के लिए है, और अब तक विषय या आइडिया क्या है?", "type": "textarea", "required": true}, {"id": "stage", "label": "What stage are you at, and when is it due?", "label_hi": "आप किस चरण पर हैं, और इसे कब जमा करना है?", "type": "text", "required": true}]'::jsonb,
   false, 10),
  ('government-exams', 'Government Jobs and Competitive Exam Pathways', 'सरकारी नौकरियाँ और प्रतियोगी परीक्षाओं के रास्ते',
   'Understand whether UPSC, SSC, banking or state exams suit you, and plan your path.',
   'समझें कि UPSC, SSC, बैंकिंग या राज्य स्तर की परीक्षाएँ आपके लिए सही हैं या नहीं, और अपना रास्ता तय करें।',
   'Eligibility and what each path involves, an honest look at time and effort, how to balance preparation with a backup plan, and a preparation outline. This is guidance, not exam coaching.',
   'पात्रता और हर रास्ते में क्या-क्या शामिल है, समय और मेहनत पर एक ईमानदार नज़र, तैयारी के साथ बैकअप योजना कैसे रखें, और तैयारी की एक रूपरेखा। यह मार्गदर्शन है, परीक्षा की कोचिंग नहीं।',
   array['video', 'phone'], 45,
   '[{"id": "exams", "label": "Which exams or posts are you interested in?", "label_hi": "आपकी रुचि किन परीक्षाओं या पदों में है?", "type": "text", "required": true}, {"id": "background", "label": "What is your education, and are you studying, working or preparing full time?", "label_hi": "आपकी पढ़ाई क्या है, और आप अभी पढ़ रहे हैं, काम कर रहे हैं या पूरा समय तैयारी कर रहे हैं?", "type": "textarea", "required": true}]'::jsonb,
   false, 11),
  ('skills-development', 'Skills and Professional Development', 'कौशल और पेशेवर विकास',
   'Identify the skills that matter for your goals and plan how to build them.',
   'अपने लक्ष्यों के लिए ज़रूरी कौशल पहचानें और उन्हें विकसित करने की योजना बनाएँ।',
   'Skills gap discussion, learning plan with milestones, and recommended resources to evaluate.',
   'कौशल की कमी पर चर्चा, पड़ावों के साथ सीखने की योजना, और परखने के लिए सुझाए गए संसाधन।',
   array['video', 'phone'], 45,
   '[{"id": "target", "label": "Which role or field are you building skills for?", "label_hi": "आप किस भूमिका या क्षेत्र के लिए कौशल विकसित कर रहे हैं?", "type": "text", "required": true}]'::jsonb,
   false, 12),
  ('parent-consultation', 'Parent Consultation', 'माता-पिता के लिए परामर्श',
   'A session for parents, alone or with their child, about education and career choices.',
   'पढ़ाई और करियर के फ़ैसलों पर माता-पिता के लिए एक सत्र, अकेले या बच्चे के साथ।',
   'Understanding your child''s options and interests, how to support a decision without pressure, and agreeing on next steps together.',
   'आपके बच्चे के विकल्पों और रुचियों को समझना, बिना दबाव के फ़ैसले में साथ कैसे दें, और मिलकर अगले कदम तय करना।',
   array['video', 'phone'], 45,
   '[{"id": "child", "label": "What is your child''s age, class or course?", "label_hi": "आपके बच्चे की उम्र, कक्षा या कोर्स क्या है?", "type": "text", "required": true}, {"id": "concern", "label": "What decision or concern would you like to discuss?", "label_hi": "आप किस फ़ैसले या चिंता पर बात करना चाहते हैं?", "type": "textarea", "required": true}, {"id": "joining", "label": "Will your child join the session?", "label_hi": "क्या आपका बच्चा भी सत्र में शामिल होगा?", "type": "text", "required": false}]'::jsonb,
   false, 13),
  ('general', 'General Career Consultation', 'सामान्य करियर परामर्श',
   'Not sure where your question fits? Start here.',
   'पता नहीं कि आपका सवाल किस सेवा में आता है? यहाँ से शुरू करें।',
   'An open conversation about your situation followed by recommended next steps.',
   'आपकी स्थिति पर खुली बातचीत, और उसके बाद सुझाए गए अगले कदम।',
   array['video', 'phone'], 45,
   '[]'::jsonb,
   false, 14);

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
