import type { Metadata } from "next";
import { AUTH_SITE_URL } from "./auth/urls.ts";

export type PublicLocale = "fa" | "en";
export const SITE_URL = AUTH_SITE_URL;
export const PUBLIC_LOCALE_HEADER = "x-atlas-public-locale";
export const publicLanguages = { fa: `${SITE_URL}/`, en: `${SITE_URL}/en`, "x-default": `${SITE_URL}/` };
export const landingContent = {
  fa: {
    name: "اطلس پیما",
    title: "اطلس پیما | اطلس تعاملی جغرافیا، تاریخ و سیاست جهان",
    heading: "جهان را در بستر زمان و مکان بشناس",
    description: "یک اطلس تعاملی برای کاوش جغرافیا، تاریخ و سیاست جهان؛ از تغییر مرزها و سرزمین‌ها تا تحولات تاریخی و حضور شخصیت‌ها، از سال ۱۸۸۶ تا امروز.",
    invitation: "نقشه را کاوش کن، تاریخ را ورق بزن.",
    enter: "ورود و کاوش نقشه",
    featuresTitle: "یک جهان، مسیرهای بی‌شمار برای کشف",
    features: [
      { title: "مرزها در گذر زمان", text: "تاریخ را روی خط زمان تغییر بده و مرزهای دوره‌های مختلف را ببین. جای کشورهایی مانند شوروی، یوگسلاوی و چکسلواکی را در نقشهٔ گذشته پیدا کن." },
      { title: "جغرافیا از چند نگاه", text: "میان نقشهٔ پیش‌فرض، فیزیکی، توپوگرافی، ماهواره‌ای و سیاسی جابه‌جا شو و سرزمین‌ها را از چشم‌اندازهای گوناگون بشناس." },
      { title: "آدم‌ها در دل تاریخ", text: "شخصیت‌ها را روی نقشه پیدا کن، دورهٔ حضورشان را بررسی کن و با جست‌وجوی افراد و کشورها، کاوش خودت را ادامه بده." },
    ],
    personalTitle: "اطلس خودت را بساز",
    personalText: "شخصیت‌های دلخواهت را اضافه کن، با تگ‌ها و دسته‌بندی‌ها مرتبشان کن و با یادداشت‌ها و نشانک‌ها، مسیر کشف خودت را نگه دار. فهرست افراد و کشورها را هم می‌توانی بر اساس فیلترهای انتخابی دانلود کنی.",
    questionsTitle: "پیش از شروع کاوش",
    questions: [
      { title: "اطلس پیما چیست؟", text: "اطلس پیما یک نقشهٔ تعاملی برای دیدن پیوند جغرافیا، تاریخ و سیاست است. با تغییر زمان می‌توانی کشورها، مرزها و شخصیت‌های ثبت‌شده برای دورهٔ انتخابی را بررسی کنی." },
      { title: "برای ورود به نقشه به حساب نیاز دارم؟", text: "بله. برای استفاده از فضای کار و ابزارهای شخصی، وارد حساب خودت شو یا از صفحهٔ ورود ثبت‌نام کن. این صفحهٔ معرفی بدون ورود در دسترس است." },
      { title: "کاوش تاریخی از چه سالی شروع می‌شود؟", text: "خط زمان از سال ۱۸۸۶ آغاز می‌شود. میزان جزئیات مرزها، شخصیت‌ها و اطلاعات سالانهٔ هر کشور به داده‌های ثبت‌شده برای همان دوره بستگی دارد." },
    ],
    about: "دربارهٔ اطلس پیما",
    login: "ورود / ثبت‌نام",
  },
  en: {
    name: "Atlas Peyma",
    title: "Atlas Peyma | Interactive Geography, History & Political Atlas",
    heading: "Discover the world through time and place",
    description: "An interactive atlas for exploring world geography, history and politics: changing borders and territories, historical developments and the people behind them, from 1886 to today.",
    invitation: "Explore the map. Turn the pages of history.",
    enter: "Sign in and explore the map",
    featuresTitle: "One world, countless paths to discovery",
    features: [
      { title: "Borders through time", text: "Move along the timeline to see borders from different periods. Find former countries such as the Soviet Union, Yugoslavia and Czechoslovakia on the historical map." },
      { title: "Geography from different perspectives", text: "Switch between the default, physical, topographic, satellite and political maps to explore landscapes and territories in different ways." },
      { title: "The people behind history", text: "Find people on the map, explore their periods of activity and continue your journey by searching for countries and historical figures." },
    ],
    personalTitle: "Build your own atlas",
    personalText: "Add your own characters, organize them with tags and groups, and keep track of your discoveries with notes and bookmarks. Download filtered directories of people and countries to continue exploring.",
    questionsTitle: "Before you explore",
    questions: [
      { title: "What is Atlas Peyma?", text: "Atlas Peyma is an interactive map connecting geography, history and politics. Change the date to explore countries, borders and people recorded for your chosen period." },
      { title: "Do I need an account to use the map?", text: "Yes. Sign in or register on the sign-in page to access the workspace and personal tools. This introduction is available without signing in." },
      { title: "How far back does the timeline go?", text: "The timeline begins in 1886. The detail available for borders, people and annual country information depends on the records available for that period." },
    ],
    about: "About Atlas Peyma",
    login: "Sign in / Register",
  },
} as const;

export function publicPath(locale: PublicLocale) { return locale === "fa" ? "/" : "/en"; }

export function landingMetadata(locale: PublicLocale): Metadata {
  const copy = landingContent[locale];
  const url = `${SITE_URL}${publicPath(locale)}`;
  const image = { url: `${SITE_URL}/social/atlas-peyma.png`, width: 1200, height: 630, alt: copy.name };
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: url, languages: publicLanguages },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
    openGraph: { type: "website", siteName: copy.name, title: copy.title, description: copy.description, url, locale: locale === "fa" ? "fa_IR" : "en_US", alternateLocale: locale === "fa" ? ["en_US"] : ["fa_IR"], images: [image] },
    twitter: { card: "summary_large_image", title: copy.title, description: copy.description, images: [image] },
  };
}

export function publicStructuredData(locale: PublicLocale) {
  const copy = landingContent[locale];
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: "اطلس پیما", alternateName: "Atlas Peyma", inLanguage: ["fa", "en"] },
      { "@type": "WebPage", "@id": `${SITE_URL}${publicPath(locale)}#page`, url: `${SITE_URL}${publicPath(locale)}`, name: copy.title, description: copy.description, inLanguage: locale, isPartOf: { "@id": `${SITE_URL}/#website` }, about: { "@id": `${SITE_URL}/#application` } },
      { "@type": "WebApplication", "@id": `${SITE_URL}/#application`, name: copy.name, url: `${SITE_URL}/`, description: copy.description, applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: ["fa", "en"] },
    ],
  };
}
