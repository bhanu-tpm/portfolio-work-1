import { Geist, Geist_Mono, Noto_Sans_Devanagari, Noto_Serif_Devanagari, Source_Serif_4 } from "next/font/google";

// Latin fonts plus Devanagari fallbacks for Hindi. The Devanagari faces use
// unicode-range, so browsers only download them when Hindi text is on the page.
const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });
const devaSans = Noto_Sans_Devanagari({
  variable: "--font-deva-sans",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});
const devaSerif = Noto_Serif_Devanagari({
  variable: "--font-deva-serif",
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  preload: false,
});

export const fontVariables = [sans, mono, serif, devaSans, devaSerif].map((f) => f.variable).join(" ");
