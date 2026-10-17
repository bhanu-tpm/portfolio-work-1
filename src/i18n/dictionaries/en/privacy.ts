type PrivacySection = { heading: string; paragraphs: string[]; items: string[] };

export const privacy = {
  meta: {
    title: "Privacy notice",
    description: "How consultation, account and AI-related data is collected, used and protected.",
  },
  title: "Privacy notice",
  intro:
    "This notice explains what information this website collects when you create an account, request a consultation or use the optional AI tools, and how it is used.",
  /** Each section renders its paragraphs, then its list items. */
  sections: [
    {
      heading: "What is collected",
      paragraphs: [],
      items: [
        "Account details: name, email address and password (passwords are handled by our authentication provider and never visible to the consultant).",
        "Consultation requests: your education or work status, goals, questions, preferences and any files you choose to attach.",
        "Appointments, messages exchanged about your request, and the consultation outcome documents prepared for you.",
        "If you use the optional AI tools: your conversation with the career guidance assistant and resumes you submit for review.",
      ],
    },
    {
      heading: "How it is used",
      paragraphs: [
        "Your information is used only to prepare for and deliver your consultation, to schedule appointments, to send you service emails (such as booking confirmations) and to keep the service secure. It is not sold or used for advertising.",
      ],
      items: [],
    },
    {
      heading: "AI processing",
      paragraphs: [
        "Some features use an external AI provider ({provider}) through our servers. AI is used to help the consultant prepare (for example, summarising your request or drafting an outcome document that the consultant then reviews and edits) and, only if you choose to use them, for the career guidance assistant and resume review.",
      ],
      items: [
        "Only the information needed for the specific task is sent. Names, email addresses, phone numbers and links are removed where feasible.",
        "{providerTerms}",
        "AI output is never treated as a final decision. Every consultation outcome is reviewed and approved by the consultant before you receive it.",
        "You can opt out of AI-assisted preparation when you submit a request, and withdraw AI consent at any time in your dashboard settings.",
      ],
    },
    {
      heading: "Storage and security",
      paragraphs: [
        "Data is stored with our database and hosting providers. Files are kept in private storage and can only be downloaded by you (for your own files and approved outcomes) and the consultant, using short-lived links. Access is restricted by role and every access to your records is checked on the server.",
      ],
      items: [],
    },
    {
      heading: "Retention",
      paragraphs: [],
      items: [
        "AI assistant conversations are deleted automatically after a retention period (default 180 days) and you can clear them at any time.",
        "Resume reviews are deleted after a retention period (default 90 days) and you can delete them at any time.",
        "Consultation records are kept for as long as needed to provide the service and follow-up, unless you ask for them to be deleted.",
      ],
    },
    {
      heading: "Your choices and rights",
      paragraphs: [
        "You can view and update your profile, change email preferences, withdraw AI consent and clear AI history from your dashboard. To request a copy or deletion of your data, contact {contact}.",
      ],
      items: [],
    },
  ] as PrivacySection[],
  contactFallback: "the contact form",
  /** The AI provider's name and data terms, chosen by AI_PROVIDER and filled into the AI section. */
  aiProviders: {
    openai: {
      name: "OpenAI",
      terms:
        "Requests are sent with provider-side storage disabled. Your data is not used to train AI models under the provider's API terms.",
    },
    gemini: {
      name: "Google Gemini",
      terms:
        "Requests are sent under Google's free Gemini API terms, which allow Google to use them to improve its products, and they may be reviewed by people at Google. This is why personal details are removed first, and why you can choose not to use AI at all.",
    },
  },
};

export type PrivacyDict = typeof privacy;
