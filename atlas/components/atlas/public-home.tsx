import { ArrowUpRight, Globe2, History, Layers3, UsersRound } from "lucide-react";
import Image from "next/image";
import { landingContent, publicStructuredData, type PublicLocale } from "@/lib/seo";

export default function PublicHome({ locale }: { locale: PublicLocale }) {
  const copy = landingContent[locale];
  const icons = [History, Layers3, UsersRound];
  return <div className="atlas-app public-home" data-theme="light" data-accent="sage">
    <a className="skip-link" href="#public-main">{locale === "fa" ? "رفتن به محتوا" : "Skip to content"}</a>
    <header className="public-header">
      <a href={locale === "fa" ? "/" : "/en"} className="public-brand"><Globe2 size={30} strokeWidth={1.4} /><span>{copy.name}</span></a>
      <nav aria-label={locale === "fa" ? "راهبری سایت" : "Site navigation"}>
        <a href="#discover">{copy.about}</a>
        <a href={locale === "fa" ? "/en" : "/"} hrefLang={locale === "fa" ? "en" : "fa"} lang={locale === "fa" ? "en" : "fa"}>{locale === "fa" ? "English" : "فارسی"}</a>
        <a className="secondary-button" href="/login">{copy.login}</a>
      </nav>
    </header>
    <main id="public-main">
      <section className="public-hero" aria-labelledby="public-title">
        <span className="public-kicker">{copy.name} · {locale === "fa" ? "جغرافیا، تاریخ و سیاست" : "Geography, history and politics"}</span>
        <h1 id="public-title">{copy.heading}</h1>
        <p className="public-intro">{copy.description}</p>
        <p className="public-invitation">{copy.invitation}</p>
        <a className="primary-button" href="/login">{copy.enter}<ArrowUpRight size={18} /></a>
        <Image className="public-map-preview" src="/social/atlas-peyma.png" alt={locale === "fa" ? "نمایی از نقشهٔ جهان در اطلس پیما" : "A world map in Atlas Peyma"} width={1200} height={630} sizes="(max-width: 760px) calc(100vw - 36px), (max-width: 1184px) calc(100vw - 64px), 1120px" loading="eager" fetchPriority="high" />
      </section>
      <section id="discover" className="public-section" aria-labelledby="discover-title">
        <h2 id="discover-title">{copy.featuresTitle}</h2>
        <div className="public-features">{copy.features.map((feature, index) => {
          const Icon = icons[index];
          return <article key={feature.title}><Icon size={27} strokeWidth={1.5} /><h3>{feature.title}</h3><p>{feature.text}</p></article>;
        })}</div>
      </section>
      <section className="public-personal public-section" aria-labelledby="personal-title"><div><h2 id="personal-title">{copy.personalTitle}</h2><p>{copy.personalText}</p></div><a className="secondary-button" href="/login">{copy.enter}<ArrowUpRight size={18} /></a></section>
      <section className="public-section public-questions" aria-labelledby="questions-title"><h2 id="questions-title">{copy.questionsTitle}</h2>{copy.questions.map(question => <article key={question.title}><h3>{question.title}</h3><p>{question.text}</p></article>)}</section>
    </main>
    <footer className="public-footer"><span>{copy.name}</span><a href="/login">{copy.login}</a><a href={locale === "fa" ? "/en" : "/"} hrefLang={locale === "fa" ? "en" : "fa"}>{locale === "fa" ? "English" : "فارسی"}</a></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(publicStructuredData(locale)).replace(/</g, "\\u003c") }} />
  </div>;
}
