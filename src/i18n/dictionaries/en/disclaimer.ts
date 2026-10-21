type DisclaimerSection = { heading: string; paragraphs: string[]; items: string[] };

export const disclaimer = {
  meta: {
    title: "Disclaimer",
    description:
      "Independent, advisory career guidance: no affiliation with or promotion of any institution, and no guaranteed outcomes.",
  },
  title: "Disclaimer",
  updated: "Last updated: 18 October 2026",
  intro:
    "Please read this disclaimer before booking a consultation or relying on anything on this website. By requesting a consultation, you confirm that you have read and understood it.",
  summaryHeading: "In short",
  summary: [
    "The guidance is independent. No university, college or institution is being promoted.",
    "The guidance is advisory. Every decision about your education and career is yours.",
    "No admission, exam result, scholarship, job, salary or visa can be guaranteed.",
    "Always confirm fees, eligibility and deadlines with the official source before acting.",
  ],
  /** Each section renders its paragraphs, then its list items. */
  sections: [
    {
      heading: "1. No affiliation, endorsement or promotion",
      paragraphs: [
        "This is an independent career guidance service. It is not affiliated with, authorised by, sponsored by or acting on behalf of any university, college, school, coaching institute, examination body, regulator, government department, employer or recruitment agency.",
        "When an institution, course, exam, company or website is mentioned, in a consultation, an outcome document, a blog post or the AI tools, it is for information and comparison only. A mention is not an endorsement, a ranking or a recommendation to enrol, and leaving one out is not a judgement against it.",
        "No payment, commission or referral fee is received from any institution for suggesting it. Suggestions are based only on what appears to suit your goals, situation and preferences.",
        "The consultant is an alumnus of the Indian Institute of Management Kozhikode (MBA). This describes the consultant's own education only: Margith is an independent service and is not affiliated with, endorsed by or acting on behalf of IIM Kozhikode or any other IIM.",
        "Names, logos and trademarks of institutions belong to their respective owners and are used only to identify them.",
      ],
      items: [],
    },
    {
      heading: "2. Guidance is advisory; decisions are yours",
      paragraphs: [
        "Consultations, outcome documents, resume feedback and website content are opinions offered in good faith to help you think through your options. They are not instructions. You (and, where relevant, your parents or guardians) remain fully responsible for choosing a course, institution, exam, job or career path, and for any application, payment or commitment you make.",
        "Please weigh the guidance alongside your own research, your circumstances and the advice of people who know you well.",
      ],
      items: [],
    },
    {
      heading: "3. No guarantee of results",
      paragraphs: [
        "Outcomes depend on many things outside the consultant's control, including your own effort and performance, competition, institutional policies and changing market conditions. Nothing in a consultation or on this website is a promise or guarantee of:",
      ],
      items: [
        "admission to any course, college or university, or a particular cut-off, rank or score;",
        "passing or clearing any exam or interview;",
        "a scholarship, education loan, fee waiver or financial aid;",
        "a job, internship, placement, promotion or particular salary;",
        "a visa, work permit or any immigration outcome.",
      ],
    },
    {
      heading: "4. Information can change",
      paragraphs: [
        "Fees, eligibility rules, syllabi, application deadlines, exam patterns, cut-offs, rankings, recognition or accreditation status, and job-market information change often. Reasonable care is taken to keep information accurate, but it may be incomplete or out of date by the time you read it.",
        "Before applying, paying or making any commitment, verify the details directly with the official website or office of the institution, exam body or regulator concerned (for example, check recognition with the relevant statutory body such as UGC or AICTE where applicable).",
      ],
      items: [],
    },
    {
      heading: "5. Based on the information you share",
      paragraphs: [
        "Guidance can only be as good as the information it is based on. If details you provide about your academic record, interests, finances or circumstances are incomplete or inaccurate, the guidance may not suit you. Please share anything you think is relevant, and say so if your situation changes.",
      ],
      items: [],
    },
    {
      heading: "6. Not legal, financial, medical or immigration advice",
      paragraphs: [
        "Career guidance is not a substitute for a qualified professional. For legal, financial or tax, immigration, medical or mental-health matters, please consult a suitably qualified and licensed professional.",
        "If you are feeling overwhelmed, anxious or unsafe, please reach out to a mental-health professional or a helpline such as Tele-MANAS (14416), the Government of India's free 24×7 mental health helpline.",
      ],
      items: [],
    },
    {
      heading: "7. AI tools",
      paragraphs: [
        "The AI career guidance assistant and resume review are automated tools. Their responses can be incomplete, outdated or wrong, and are not reviewed by the consultant before you see them. Treat them as a starting point for your own research, not as professional advice. Consultation outcome documents are always reviewed and approved by the consultant before you receive them.",
      ],
      items: [],
    },
    {
      heading: "8. Blog posts and external links",
      paragraphs: [
        "Blog posts and resources are general information written for a wide audience. They are not personalised advice for your situation.",
        "Links to other websites are provided for convenience. Their content, accuracy, privacy practices and services are the responsibility of their owners, not of this website.",
      ],
      items: [],
    },
    {
      heading: "9. Testimonials",
      paragraphs: [
        "Any testimonials or examples shared describe the experiences of individual people, published with their permission. They are not typical or guaranteed results, and your experience may differ.",
      ],
      items: [],
    },
    {
      heading: "10. Limitation of liability",
      paragraphs: [
        "To the extent permitted by applicable law, the consultant is not liable for any loss or damage (including loss of admission, fees, opportunity, income or time) arising from decisions you make or actions you take based on the guidance, from information provided by third parties, or from changes made by institutions or authorities.",
        "Nothing in this disclaimer excludes or limits any liability that cannot be excluded under applicable law, or affects your rights as a consumer under Indian law, including the Consumer Protection Act, 2019.",
      ],
      items: [],
    },
    {
      heading: "11. Questions and concerns",
      paragraphs: [
        "If something in your consultation is unclear, or you believe a mistake has been made, please raise it with {contact} as soon as possible so it can be discussed and, where appropriate, corrected.",
        "This disclaimer may be updated from time to time. The date at the top shows when it last changed.",
      ],
      items: [],
    },
  ] as DisclaimerSection[],
  contactFallback: "the consultant through the contact form",
};

export type DisclaimerDict = typeof disclaimer;
