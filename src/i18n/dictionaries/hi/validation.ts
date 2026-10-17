import type { ValidationDict } from "../en/validation";

// Wording follows hindi_website_localization_review.xlsx (Recommended Hindi):
// "characters" → वर्ण (अक्षर is kept for "letter"), "privacy notice/policy" → गोपनीयता नीति.
export const validation: ValidationDict = {
  messages: {
    correctFields: "कृपया चिह्नित फ़ील्ड ठीक करें।",
    generic: "कुछ गलत हो गया। कृपया फिर से कोशिश करें।",
    tooManyRequests: "बहुत ज़्यादा अनुरोध हो गए हैं। कृपया थोड़ा रुककर फिर कोशिश करें।",
    invalidEmail: "मान्य ईमेल पता दर्ज करें",
    passwordMin: "कम से कम 10 वर्ण इस्तेमाल करें",
    passwordMax: "अधिकतम 72 वर्ण इस्तेमाल करें",
    passwordMix: "कम से कम एक अक्षर और एक अंक शामिल करें",
    acceptPrivacy: "कृपया गोपनीयता नीति और अस्वीकरण स्वीकार करें",
    enterPassword: "अपना पासवर्ड दर्ज करें",
    passwordsMismatch: "दोनों पासवर्ड मेल नहीं खाते",
  },
  patterns: {
    required: "{label} ज़रूरी है",
    min: "{label} में कम से कम {n} वर्ण होने चाहिए",
    max: "{label} में अधिकतम {n} वर्ण हो सकते हैं",
    maxPlain: "अधिकतम {n} वर्ण हो सकते हैं",
  },
  labels: {
    name: "नाम",
    subject: "विषय",
    message: "संदेश",
    thisField: "यह फ़ील्ड",
  },
};
