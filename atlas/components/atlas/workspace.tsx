"use client";
import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { Globe2, Map, UsersRound, Bookmark, SlidersHorizontal, ChevronRight, ArrowUpRight, Check, X, HelpCircle, Menu, Palette, LockKeyhole, Settings2, ArrowLeft, CalendarDays, UserPlus, CloudCheck, HardDrive, RotateCcw, ExternalLink, ShieldCheck, Mail } from "lucide-react";
import { type Person, type Country, type PersonalState, type Viewport, type Role, defaultSettings, defaultViewport, visiblePeople, roleLabels, regions } from "@/lib/atlas";
import { createClient } from "@/lib/supabase/client";
import { formatCalendarDate } from "@/lib/calendar";
import { customAccentStyle } from "@/lib/accent-colors";
import { getTimelineRange, selectedTimelineRange, timelineMonth, timelineMonthValue, utcMonth, TIMELINE_START_YEAR } from "@/lib/timeline";
import { signOutLocally } from "@/app/actions/local-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarProvider, useI18n } from "@/components/i18n/provider";
import LanguageSwitcher from "@/components/i18n/language-switcher";
import { type TranslationKey } from "@/lib/i18n";
import { usePersonalState } from "./use-personal-state";
import MapCanvas, { countryViewport } from "./map-canvas";
import PersonSpotlight from "./person-spotlight";
import { buildPersonProfiles, personProfileId, profilePeople, uniquePeople } from "@/lib/person-profiles";
import { useHistoricalBorders } from "./use-historical-borders";
import { peopleAtHistoricalBorders } from "@/lib/historical-boundaries";
import { timelineYearFromQuery } from "@/lib/search";
import { countryFocusDate } from "@/lib/country-entities";
import CountryProfile from "./country-profile";
import CountryPeople from "./country-people";
import { withCountryProfiles } from "@/lib/country-profiles";
import { mapResultHref, mapTargetId, parseMapTarget, type MapTarget } from "@/lib/map-links";
import Modal from "./modal";
import Timeline from "./timeline";
import MapExperience from "./map-experience";
import CharactersPage from "./characters-page";
import PeopleDirectory from "./people-directory";
import CountryDirectory from "./country-directory";
import DirectoryDateFilters from "./directory-date-filters";
import { monthIndex, personInRange, type DirectoryRange } from "@/lib/directory-filters";
import { useBrowserPeople } from "./use-browser-people";
import { shownPeople } from "@/lib/browser-people";
import AccountSettings, { AccountAvatar } from "./account-settings";
import VisibilitySettings from "./visibility-settings";
import { CalendarSettings, TimelineRangeSettings } from "./timeline-settings";
import { AppearanceControls, LayerControls } from "./preferences";
import SearchBox from "./search-box";
import MapSubbar from "./map-subbar";
import MapHeading from "./map-heading";
import MapSourceCredits from "./map-source-credits";
import OnboardingTour from "./onboarding-tour";
import SearchResults from "./search-results";
import AdminPanel from "./admin-panel";
import FeedbackPage from "./feedback-page";
import { sendFeedback, loadFeedback, setFeedbackStatus } from "@/app/actions/feedback";
import { canManageAtlas, type AccessRole, type Publication, type AdministrationActions } from "@/lib/administration";
import { submitCharacter, loadAdminPanel, saveManagedCharacter, deleteManagedCharacter, reviewCharacter, searchAtlasAccounts, setAtlasAdmin } from "@/app/actions/administration";
import { buildSearchIndex, defaultSearchState, parseSearchState, searchUrl, type SearchState, type SearchDocument } from "@/lib/search";

const feedbackActions = { load: loadFeedback, setStatus: setFeedbackStatus };
const administrationActions: AdministrationActions = { load: loadAdminPanel, save: saveManagedCharacter, remove: deleteManagedCharacter, review: reviewCharacter, accounts: searchAtlasAccounts, setAdmin: setAtlasAdmin };
type Page = "map" | "people" | "bookmarks" | "characters" | "settings" | "account-settings" | "search" | "admin" | "feedback";
const pageLabels: Record<Page, TranslationKey> = { map: "Explore map", people: "Directories", bookmarks: "Directories", characters: "My characters", settings: "My workspace", "account-settings": "My settings", search: "Search results", admin: "Administration panel", feedback: "Contact administrators" };
const nav = [{ id: "map", icon: Map, label: "Explore map" }, { id: "people", icon: UsersRound, label: "Directories" }] as const;

export default function Workspace({ mode, people: importedPeople, countries: importedCountries, userId, email, initialState, initialPage = "map", initialSearch, accessRole = "user", publicationAvailable = false, initialPublications = [] }: { mode: "local" | "account"; people: Person[]; countries: Country[]; userId: string; initialPage?: "map" | "characters" | "search" | "admin"; initialSearch?: SearchState; accessRole?: AccessRole; publicationAvailable?: boolean; initialPublications?: Publication[]; email?: string; initialState?: PersonalState }) {
  const { t, text, n, countryName, locale } = useI18n();
  const router = useRouter();
  const countries = useMemo(() => withCountryProfiles(importedCountries), [importedCountries]);
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null);
  const [scrollRequest, setScrollRequest] = useState(0);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [page, setPage] = useState<Page>(initialPage);
  const [customDirectoryRange, setDirectoryRange] = useState<DirectoryRange | null>(null);
  const [directoryType, setDirectoryType] = useState<"people" | "countries">("people");
  const [sharedPeople, setSharedPeople] = useState(importedPeople);
  const [publicationUpdates, setPublicationUpdates] = useState<{ source: Publication[]; items: Publication[] } | null>(null);
  const publications = useMemo(() => [...new globalThis.Map([...initialPublications, ...(publicationUpdates?.source === initialPublications ? publicationUpdates.items : [])].map(item => [item.localId, item] as const)).values()], [initialPublications, publicationUpdates]);
  const awaitingReview = publications.some(item => item.status === "pending");
  useEffect(() => {
    if (mode !== "account" || !publicationAvailable || !awaitingReview) return;
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [mode, publicationAvailable, awaitingReview, router]);
  // Server refreshes carry the latest shared collection after administrative changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSharedPeople(importedPeople); }, [importedPeople]);
  const [searchState, setSearchState] = useState<SearchState>(initialSearch ?? defaultSearchState);
  const [searchDraft, setSearchDraft] = useState(initialSearch?.query ?? "");
  const [toast, setToast] = useState(""); const notify = useCallback((text: string) => setToast(text), []);
  const personal = usePersonalState(mode, userId, initialState, notify); const { state, settings: changeSettings } = personal;
  const { settings } = state;
  const { endYear } = getTimelineRange();
  const timelineRange = selectedTimelineRange(settings.timelineYears);
  const timelineYearLabel = (index: number) => {
    const { year, month } = timelineMonth(index);
    return formatCalendarDate(utcMonth(year, month), locale, settings.calendar, { year: "numeric" });
  };
  const browser = useBrowserPeople(userId, notify, publications);
  const { people: drafts, hidden, tags, groups } = browser;
  const allProfiles = useMemo(() => buildPersonProfiles([...sharedPeople, ...drafts]), [sharedPeople, drafts]);
  const allPeople = useMemo(() => [...allProfiles.values()].flatMap(profilePeople), [allProfiles]);
  const people = useMemo(() => shownPeople(allPeople, { hidden, tags, groups }), [allPeople, hidden, tags, groups]);
  const profiles = useMemo(() => buildPersonProfiles(people), [people]);
  const visibleTermIds = useMemo(() => new Set(people.map(person => person.id)), [people]);
  const organization = useMemo(() => ({
    tags: Object.fromEntries(Object.entries(tags).filter(([id]) => profiles.has(id))),
    groups: groups.flatMap(group => {
      const personIds = group.personIds.filter(id => profiles.has(id));
      return personIds.length ? [{ ...group, personIds }] : [];
    }),
  }), [tags, groups, profiles]);
  const temporal = useHistoricalBorders(settings.year, settings.month);
  const mapPeople = useMemo(() => temporal.features ? peopleAtHistoricalBorders(people, temporal.features) : people, [people, temporal.features]);
  const bookmarks = [...new Set([...state.bookmarks, ...browser.bookmarks].map(personProfileId))];
  const bookmark = async (id: string) => {
    const profileId = personProfileId(id);
    const savedInBrowser = browser.bookmarks.includes(profileId);
    if (id.startsWith("custom:")) { browser.bookmark(profileId); return; }
    if (savedInBrowser && !browser.bookmark(profileId)) return;
    if (!savedInBrowser || state.bookmarks.some(saved => personProfileId(saved) === profileId)) {
      await personal.bookmark(allProfiles.get(profileId)?.terms.find(term => term.id === profileId)?.id ?? id);
    }
  };
  const [viewport, setViewport] = useState<Viewport>(defaultViewport);
  const [requestedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [tourRequest, setTourRequest] = useState(0);
  const [modal, setModal] = useState<"help" | null>(null);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(""), 4500); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => {
    const restore = () => {
      if (window.location.pathname === "/workspace/search") {
        const restored = parseSearchState(new URLSearchParams(window.location.search));
        setSearchState(restored); setSearchDraft(restored.query); setPage("search");
      } else setPage(window.location.pathname === "/workspace/admin" ? "admin" : window.location.pathname === "/workspace/characters" ? "characters" : "map");
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const filtered = useMemo(() => uniquePeople(visiblePeople(mapPeople, settings), true), [mapPeople, settings]);
  const searchIndex = useMemo(() => buildSearchIndex(people, countries, organization), [people, countries, organization]);
  const currentPeople = useMemo(() => visiblePeople(mapPeople, { ...settings, region: "All regions", mapRegions: defaultSettings.mapRegions, roles: Object.keys(roleLabels) as Role[] }), [mapPeople, settings]);
  const selectedProfile = selectedPerson && profiles.get(personProfileId(selectedPerson.id));
  const selectedTerm = currentPeople.find(person => person.id === selectedPerson?.id) ??
    currentPeople.find(person => selectedProfile?.id === personProfileId(person.id) && person.countryCode === requestedCountry) ??
    currentPeople.find(person => selectedProfile?.id === personProfileId(person.id));
  const selectedCountry = selectedTerm?.countryCode ?? requestedCountry;
  const country = countries.find(c => c.code === selectedCountry);
  const countryPeople = uniquePeople(currentPeople.filter(p => p.countryCode === selectedCountry));
  const countryCount = new Set(people.map(p => p.countryCode)).size;

  const go = (next: Page) => { if (window.location.pathname !== "/workspace") window.history.pushState(null, "", "/workspace"); setPage(next); setSideOpen(false); };
  // The cached character route can reuse this workspace after returning to the map.
  const openCharacters = () => { setEditingCharacterId(null); setPage("characters"); setSideOpen(false); };
  const openAdmin = () => { setPage("admin"); setSideOpen(false); };
  const selectPerson = (person: Person, focus = false) => { setSelectedCountry(person.countryCode); setSelectedPerson(person); setPage("map"); if (focus) { setSideOpen(false); const position = browser.positions[person.id]; setViewport(position ? { k: 2.7, x: 500 - position.x * 2.7, y: 270 - position.y * 2.7 } : countryViewport(person.lng, person.lat)); } };
  const selectCountry = (code: string | null, focus = false) => {
    setSelectedCountry(code); setSelectedPerson(null);
    if (code === null) {
      setMapTarget(null);
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    const c = countries.find(c => c.code === code);
    if (focus && c) { setPage("map"); setViewport(countryViewport(c.lng, c.lat)); }
  };
  const resetFilters = () => { changeSettings({ roles: defaultSettings.roles, region: "All regions", mapRegions: defaultSettings.mapRegions, nato: false }); };
  function runSearch(next: SearchState) {
    const newQuery = page !== "search" || next.query !== searchState.query;
    setSearchState(next); setSearchDraft(next.query); setPage("search"); setSideOpen(false);
    if (newQuery) requestAnimationFrame(() => document.getElementById("atlas-search-heading")?.focus({ preventScroll: true }));
    const url = searchUrl(next);
    if (window.location.pathname + window.location.search !== url) window.history.pushState(null, "", url);
  }
  function openSearchResult(document: SearchDocument, preferredDate?: { year: number; month: number }) {
    if (document.person) {
      const person = document.person;
      const start = person.startYear === null ? timelineRange.min : Math.max(timelineRange.min, Math.ceil(person.startYear * 12 - .0001));
      const end = person.endYear === null ? timelineRange.max : Math.min(timelineRange.max, Math.ceil(person.endYear * 12 - .0001) - 1);
      if (start > end) { notify("This date is outside your timeline range."); return; }
      const current = settings.year * 12 + settings.month;
      const preferred = current >= start && current <= end ? current : person.startYear === null ? end : start;
      const termDate = timelineMonth(preferred);
      changeSettings({ region: "All regions", mapRegions: defaultSettings.mapRegions, roles: defaultSettings.roles, ...termDate });
      selectPerson(person, true);
    } else if (document.country) {
      const queryYear = Number((page === "search" ? searchState.year : "") || timelineYearFromQuery(searchDraft));
      const focus = preferredDate ?? countryFocusDate(document.country.code, queryYear >= TIMELINE_START_YEAR && queryYear <= endYear ? queryYear : settings.year, queryYear >= TIMELINE_START_YEAR && queryYear <= endYear ? 0 : settings.month);
      const date = focus.year * 12 + focus.month;
      if (date < timelineRange.min || date > timelineRange.max) { notify("This date is outside your timeline range."); return; }
      setSideOpen(false);
      changeSettings({ region: "All regions", mapRegions: defaultSettings.mapRegions, roles: defaultSettings.roles, ...focus }); selectCountry(document.country.code, true); }
    const target: MapTarget | null = document.person ? { kind: "person", id: document.person.id } : document.country ? { kind: "country", id: document.country.code } : null;
    if (target) { setMapTarget(target); setScrollRequest(value => value + 1); const href = mapResultHref(document); if (location.pathname + location.search + location.hash !== href) window.history.pushState(null, "", href); }
  }
  const restoreMap = useRef(() => {});
  useLayoutEffect(() => { restoreMap.current = () => {
    if (location.pathname !== "/workspace") return;
    const target = parseMapTarget(location.hash);
    if (target?.kind === "person") { const person = people.find(person => person.id === target.id) ?? people.find(person => personProfileId(person.id) === personProfileId(target.id)); if (person) openSearchResult({ person } as SearchDocument); }
    else if (target?.kind === "country") { const country = countries.find(country => country.code === target.id); if (country) openSearchResult({ country } as SearchDocument); }
  }; });
  useEffect(() => {
    if (!browser.ready) return;
    const restore = () => restoreMap.current();
    const timer = window.setTimeout(restore, 0);
    window.addEventListener("hashchange", restore); window.addEventListener("popstate", restore);
    return () => { clearTimeout(timer); window.removeEventListener("hashchange", restore); window.removeEventListener("popstate", restore); };
  }, [browser.ready]);
  useEffect(() => {
    if (page !== "map" || !mapTarget || !scrollRequest) return;
    const timer = window.requestAnimationFrame(() => {
      const element = document.getElementById(mapTargetId(mapTarget));
      element?.querySelector(".inspector")?.scrollTo({ top: 0, behavior: "instant" });
      element?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      element?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(timer);
  }, [page, mapTarget, scrollRequest]);
  async function signOut() {
    try {
      if (mode === "local") await signOutLocally();
      else { const { error } = await createClient().auth.signOut(); if (error) throw error; }
      window.location.assign("/login");
    } catch { notify("Sign-out failed. Please try again."); }
  }
  const dateValue = timelineMonthValue(settings.year * 12 + settings.month);
  const directoryRange = customDirectoryRange ?? { from: dateValue, to: dateValue };
  const cards = page === "bookmarks" ? people.filter(p => bookmarks.includes(personProfileId(p.id))) : people.filter(person => personInRange(person, directoryRange, timelineRange) && (settings.region === "All regions" || person.region === settings.region) && settings.roles.includes(person.role));
  const bookmarkCount = bookmarks.filter(id => profiles.has(id)).length;
  const inactiveProfile = !selectedTerm && selectedProfile && selectedProfile.terms.length > 1 ? selectedProfile : undefined;
  const activePerson = selectedTerm ?? (inactiveProfile ? undefined : countryPeople.find(p => p.role === "leader") ?? countryPeople[0]);
  const spotlightProfile = activePerson ? profiles.get(personProfileId(activePerson.id)) : inactiveProfile;

  return <CalendarProvider calendar={settings.calendar}><div className="atlas-app" data-theme={settings.theme} data-accent={settings.accent} style={{ "--font-scale": settings.fontSize / 100, ...customAccentStyle(settings) } as React.CSSProperties & { "--font-scale": number }}>
    <a href="#main-content" className="skip-link">{t("Skip to content")}</a>
    {sideOpen && <button className="sidebar-scrim" aria-label={t("Close navigation")} onClick={() => setSideOpen(false)} />}
    <aside className={`sidebar ${sideOpen ? "open" : ""}`}><a className="brand" href={locale === "fa" ? "/" : "/en"}><span className="brand-mark"><Globe2 size={25} strokeWidth={1.5} /></span><span>{t("Atlas Peyma")}</span></a><div className="brand-spacer" aria-hidden="true" /><span className="nav-heading">{t("DISCOVER")}</span><nav data-tour="navigation" aria-label={t("Main navigation")}>{nav.map(({ id, icon: Icon, label }) => {
      const active = page === id || (id === "people" && page === "bookmarks");
      return <button key={id} className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => go(id)}><Icon size={19} strokeWidth={1.7} /><span>{t(label)}</span></button>;
    })}</nav><span className="nav-heading your-space">{t("My Atlas")}</span><nav aria-label={t("Personal workspace")}><Link className={`nav-item ${page === "characters" ? "active" : ""}`} aria-current={page === "characters" ? "page" : undefined} href="/workspace/characters" onNavigate={openCharacters}><UserPlus size={19} strokeWidth={1.7} /><span>{t("My characters")}</span>{browser.people.length > 0 && <span className="nav-count">{n(browser.people.length)}</span>}</Link><button className={`nav-item ${page === "settings" ? "active" : ""}`} aria-current={page === "settings" ? "page" : undefined} onClick={() => go("settings")}><SlidersHorizontal size={19} strokeWidth={1.7} /><span>{t("My workspace")}</span></button><button className={`nav-item ${page === "account-settings" ? "active" : ""}`} aria-current={page === "account-settings" ? "page" : undefined} onClick={() => go("account-settings")}><Settings2 size={19} strokeWidth={1.7} /><span>{t("My settings")}</span></button>{mode === "account" && canManageAtlas(accessRole) && <Link className={`nav-item ${page === "admin" ? "active" : ""}`} aria-current={page === "admin" ? "page" : undefined} href="/workspace/admin" onNavigate={openAdmin}><ShieldCheck size={19} /><span>{t("Administration panel")}</span></Link>}</nav><div className="sidebar-bottom"><button className={`nav-item ${page === "feedback" ? "active" : ""}`} aria-current={page === "feedback" ? "page" : undefined} onClick={() => go("feedback")}><Mail size={18} /><span>{t("Contact administrators")}</span></button><button data-tour="about" className="nav-item" onClick={() => setModal("help")}><HelpCircle size={18} strokeWidth={1.7} /><span>{t("About this atlas")}</span><ArrowUpRight size={14} /></button></div></aside>
    <div className="app-main"><header className="topbar"><div className="breadcrumb"><button data-tour="mobile-navigation" className="icon-button mobile-menu" aria-label={t("Open navigation")} onClick={() => setSideOpen(true)}><Menu size={20} /></button><span className="breadcrumb-icon"><Globe2 size={17} /></span><span>{t("Workspace")}</span><ChevronRight size={13} /><strong>{t(pageLabels[page])}</strong></div><SearchBox organization={organization} onOrganization={(type, value) => runSearch({ ...defaultSearchState, type: "person", [type === "tag" ? "tag" : "group"]: value })} index={searchIndex} query={searchDraft} onQuery={setSearchDraft} onSubmit={() => runSearch({ ...searchState, query: searchDraft })} onSelect={openSearchResult} /><div className="topbar-actions"><LanguageSwitcher /><button className="icon-button help-button" aria-label={t("Help and data information")} onClick={() => setModal("help")}><HelpCircle size={18} /></button><span className="topbar-divider" /><button data-tour="profile" className="profile-button" onClick={() => go("account-settings")} aria-label={t("Open profile and preferences")}><AccountAvatar name={state.displayName} photo={browser.profilePhoto} /><span><strong>{state.displayName}</strong><small>{mode === "local" ? t("Local demo account") : t("Personal account")}</small></span><ChevronRight size={14} /></button></div></header>
      <main className="main-content" id="main-content">
      {page !== "search" && <div className="page-heading"><div>
        <h1>{page === "map" ? <MapHeading /> : t(pageLabels[page])}</h1>
        {(page === "people" || page === "bookmarks") && <p>{t("Browse people and countries across history.")}</p>}
        {page === "characters" && <p>{t("Create a person for your own map.")}</p>}
        {page === "feedback" && <p>{t("Send a suggestion or report a bug.")}</p>}
        {page === "admin" && <p>{t("Review publication requests and manage the shared map.")}</p>}
      </div>{(page === "people" || page === "bookmarks") && <button type="button" className="secondary-button directory-bookmarks-button"
        aria-pressed={page === "bookmarks"} onClick={() => go(page === "bookmarks" ? "people" : "bookmarks")}>
        <Bookmark size={16} fill={page === "bookmarks" ? "currentColor" : "none"} />{t("Bookmarks")}{bookmarkCount > 0 && <span className="nav-count">{n(bookmarkCount)}</span>}
      </button>}</div>}

      {page === "admin" && canManageAtlas(accessRole) && <AdminPanel feedbackActions={feedbackActions} accessRole={accessRole} countries={importedCountries} actions={administrationActions} onPeopleChange={setSharedPeople} />}
      {page === "feedback" && <FeedbackPage onSend={mode === "account" ? sendFeedback : undefined} />}
      {page === "search" && <SearchResults groups={organization.groups} index={searchIndex} state={searchState} onChange={runSearch} onSelect={openSearchResult} />}
      {page === "map" && <>
      <MapExperience targetId={mapTarget ? mapTargetId(mapTarget) : undefined}><div className="map-workspace"><section className="map-card"><MapSubbar count={filtered.length} year={settings.year} month={settings.month} /><MapCanvas selectedPersonId={activePerson?.id ?? null} people={filtered} positions={browser.positions} onMovePerson={browser.move} settings={settings} viewport={viewport} onViewport={setViewport} selectedCountry={selectedCountry} onCountry={code => selectCountry(code)} onPerson={person => selectPerson(person)} /></section>
      <aside className="inspector" aria-label={country ? t("{name} details", { name: countryName(country.name) }) : t("Map controls")}>{country ? <><button className="text-link back-to-layers" onClick={() => selectCountry(null)}><ArrowLeft size={14} />{" " + t("Back to map controls")}</button><CountryProfile key={`profile:${country.code}`} country={country} count={countryPeople.length} year={settings.year} month={settings.month} />{spotlightProfile && <PersonSpotlight key={spotlightProfile.id} profile={spotlightProfile} activeTerm={activePerson} bookmarked={bookmarks.includes(spotlightProfile.id)} onBookmark={() => bookmark(activePerson?.id ?? spotlightProfile.terms[0].id)} />}{!spotlightProfile && <div className="no-country-people"><UsersRound size={25} /><p>{t("No figures recorded for this date.")}</p><small>{t("Try a different year on the timeline.")}</small></div>}<CountryPeople key={`people:${country.code}`} people={countryPeople.filter(person => personProfileId(person.id) !== spotlightProfile?.id)} onSelect={setSelectedPerson} /></> : <><div className="inspector-heading"><span className="inspector-heading-icon"><SlidersHorizontal size={19} /></span><div><h2>{t("Map controls")}</h2></div></div><LayerControls settings={settings} onChange={changeSettings} onReset={resetFilters} onResetPositions={browser.resetPositions} canResetPositions={Object.keys(browser.positions).length > 0} /></>}</aside></div><Timeline settings={settings} onChange={changeSettings} /></MapExperience><div className="stats-row"><div className="stat"><span className="stat-icon"><Globe2 size={20} strokeWidth={1.5} /></span><div><strong>{n(countryCount)}<small>{t("places to discover")}</small></strong><span>{t("Across the imported collection")}</span></div></div><div className="stat"><span className="stat-icon"><UsersRound size={20} strokeWidth={1.5} /></span><div><strong>{n(profiles.size)}<small>{t("people & perspectives")}</small></strong><span>{t("Political, military & beyond")}</span></div></div><div className="stat"><span className="stat-icon"><CalendarDays size={20} strokeWidth={1.5} /></span><div><strong>{n(Math.floor((timelineRange.max - timelineRange.min) / 12), { useGrouping: false })}<small>{t("years to explore")}</small></strong><span>{t("Follow the timeline, {start}–{end}", { start: timelineYearLabel(timelineRange.min), end: timelineYearLabel(timelineRange.max) })}</span></div></div></div></>}

      {page === "people" && <>
        <div className="directory-tabs" role="tablist" aria-label={t("Directory sections")}>{(["people", "countries"] as const).map(type => <button key={type} id={`directory-tab-${type}`} type="button" role="tab" tabIndex={directoryType === type ? 0 : -1} aria-selected={directoryType === type} aria-controls="directory-panel" onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? "people" : event.key === "End" ? "countries" : type === "people" ? "countries" : "people"; setDirectoryType(next); document.getElementById(`directory-tab-${next}`)?.focus(); }} onClick={() => setDirectoryType(type)}>{t(type === "people" ? "People" : "Countries")}</button>)}</div>
        <div className="directory-toolbar"><div><h2>{t(directoryType === "people" ? "People directory" : "Country directory")}</h2></div><div className="directory-filters"><label>{t("Region")}<select className="soft-input" aria-label={t("Directory region")} value={settings.region} onChange={event => changeSettings({ region: event.target.value as typeof settings.region })}>{regions.map(region => <option key={region} value={region}>{text(region)}</option>)}</select></label></div></div>
        <DirectoryDateFilters range={directoryRange} bounds={timelineRange} onChange={setDirectoryRange} />
      </>}
      {page === "people" && directoryType === "countries" && <div id="directory-panel" role="tabpanel" aria-labelledby="directory-tab-countries"><CountryDirectory countries={countries} year={settings.year} month={settings.month} range={directoryRange} bounds={timelineRange} region={settings.region} onLocate={country => { const { year, month } = timelineMonth(monthIndex(directoryRange.from)); openSearchResult({ country } as SearchDocument, countryFocusDate(country.code, year, month)); }} /></div>}
      {(page === "people" && directoryType === "people" || page === "bookmarks") && <div id={page === "people" ? "directory-panel" : undefined} role={page === "people" ? "tabpanel" : undefined} aria-labelledby={page === "people" ? "directory-tab-people" : undefined}><PeopleDirectory exportName={page === "bookmarks" ? "bookmarks" : "people"} people={cards} browser={browser} bookmarks={bookmarks} onBookmark={bookmark} onLocate={person => openSearchResult({ person } as SearchDocument)} onEdit={id => { setEditingCharacterId(id); setPage("characters"); }}>{page === "bookmarks" && <div className="directory-toolbar"><div><h2>{t("Your bookmarked people")}</h2><span>{t(bookmarkCount === 1 ? "{count} person" : "{count} people", { count: bookmarkCount })}{t(" \u00b7 across all dates")}</span></div></div>}</PeopleDirectory></div>}

      {page === "characters" && <CharactersPage key={editingCharacterId ?? "new"} initialPerson={browser.people.find(person => person.id === editingCharacterId)} countries={importedCountries} publications={publications} publicationAvailable={mode === "account" && publicationAvailable} onPublish={mode === "account" ? async person => { const result = await submitCharacter({ localId: person.id.slice(7), character: person }); if (result.ok) { setPublicationUpdates(previous => ({ source: initialPublications, items: [...(previous?.source === initialPublications ? previous.items : []).filter(item => item.localId !== result.data.localId), result.data] })); notify("Character sent for review."); } return result; } : undefined} people={browser.people} ready={browser.ready} onAdd={browser.add} onUpdate={browser.update} onRemove={browser.remove} canLocate={person => visibleTermIds.has(person.id)} onLocate={person => openSearchResult({ person } as SearchDocument)} />}

      {page === "settings" && <div className="settings-grid">
        <VisibilitySettings profiles={[...allProfiles.values()]} browser={browser} />
        <TimelineRangeSettings key={settings.calendar} settings={settings} onChange={patch => { setDirectoryRange(null); changeSettings(patch); }} />
        <CalendarSettings settings={settings} onChange={changeSettings} />
        <section className="settings-card"><div className="settings-card-heading"><span className="large-icon"><Palette size={23} /></span><div><h2>{t("Look & feel")}</h2><p>{t("A softer space for a bigger picture.")}</p></div></div><AppearanceControls settings={settings} onChange={changeSettings} /></section></div>}
      {page === "account-settings" && <AccountSettings mode={mode} email={email} displayName={state.displayName} photo={browser.profilePhoto}
        ready={browser.ready} onSaveName={personal.saveName} onPhoto={browser.setProfilePhoto} onSignOut={signOut} />}

      </main><footer className="app-footer"><span>{t("ATLAS") + " "}<span>·</span>{" " + t("Look closer. Understand more.")}</span><div>{personal.sync === "error" ? <><span className="sync-error">{t("Changes haven’t synced")}</span><button className="text-link" onClick={personal.retry}><RotateCcw size={11} />{t("Retry")}</button></> : <>{mode === "local" ? <HardDrive size={12} /> : <CloudCheck size={12} />}<span>{!personal.ready ? t("Opening your workspace…") : personal.sync === "saving" ? t("Saving preferences…") : mode === "local" ? t("Demo · saved on this device") : t("Preferences synced")}</span></>}</div></footer></div>
    {personal.ready && browser.ready && <OnboardingTour requestId={tourRequest} onStart={() => go("map")} onComplete={() => document.querySelector<HTMLButtonElement>('[data-tour="fullscreen"]')?.click()} />}
    {toast && <div className="toast" role="status"><span><Check size={16} /></span>{text(toast)}<button className="icon-plain" aria-label={t("Dismiss notification")} onClick={() => setToast("")}><X size={15} /></button></div>}
    {modal === "help" && <Modal title={t("A little context goes a long way.")} onClose={() => setModal(null)} className="help-modal"><span className="large-icon"><Globe2 size={27} /></span><div className="help-item"><UsersRound size={19} /><div><h3>{t("People, as recorded")}</h3><p>{t("All") + " "}{n(allPeople.length)}{" " + t("original records are preserved. Titles and open-ended terms are imported data and may be outdated. They are not a verified live directory.")}</p></div></div><div className="help-item"><CalendarDays size={19} /><div><h3>{t("Travel through the collection")}</h3><p>{t("The timeline filters term dates. Some dates are approximate. Geographic boundaries and the NATO layer stay at their original snapshot throughout history.")}</p></div></div><div className="help-item"><Map size={19} /><div><h3>{t("A map is one perspective")}</h3><p>{t("Country geometry comes from Natural Earth via world-atlas. Country assignment follows coordinates and may be approximate near borders. Boundaries don’t imply an endorsement.")}</p><a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer" className="text-link">Natural Earth<ExternalLink size={11} /></a></div></div><div className="help-item"><Globe2 size={19} /><MapSourceCredits /></div><div className="help-item"><Map size={19} /><div><h3>{t("Historical map data")}</h3><a className="text-link" href="https://icr.ethz.ch/data/cshapes/" target="_blank" rel="noreferrer">CShapes 2.0</a>{" \u00b7 "}<a className="text-link" href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a></div></div><div className="help-item"><LockKeyhole size={19} /><div><h3>{t("Your space stays personal")}</h3><p>{mode === "local" ? t("Your local demo account requires sign-in. Its preferences, bookmarks and notes stay in this browser.") : t("Account data is protected by Supabase authentication and owner-based database policies.")}</p></div></div><button type="button" className="secondary-button replay-tour-button" onClick={() => { setModal(null); setTourRequest(value => value + 1); }}><RotateCcw size={16} />{t("Replay tour")}</button></Modal>}
  </div></CalendarProvider>;
}
