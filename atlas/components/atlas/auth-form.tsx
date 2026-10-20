"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Globe2, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signInLocally } from "@/app/actions/local-auth";
import Link from "next/link";
import { useI18n } from "@/components/i18n/provider";
import LanguageSwitcher from "@/components/i18n/language-switcher";
import { authErrorKey } from "@/lib/i18n";
import { AUTH_CALLBACK_URL } from "@/lib/auth/urls";
export default function AuthForm({ configured, local = false, updatePassword = false, confirmationError = false, passwordUpdated = false }: { configured: boolean; local?: boolean; updatePassword?: boolean; confirmationError?: boolean; passwordUpdated?: boolean }) {
  const { t, text, n } = useI18n();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [visible, setVisible] = useState(false); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setError(""); setMessage("");
    if (!configured) {
      setError("Account access is not enabled yet. Please try again once registration and sign-in are available.");
      return;
    }
    setBusy(true);
    try {
      if (local) {
        const result = await signInLocally(email, password);
        if (result.error) throw new Error(result.error);
        window.location.assign("/workspace");
        return;
      }
      const supabase = createClient();
      if (updatePassword) {
        const { data, error: sessionError } = await supabase.auth.getUser();
        if (sessionError || !data.user) throw new Error("This recovery link has expired. Request a new one from the sign-in page.");
        const { error } = await supabase.auth.updateUser({ password }); if (error) throw error;
        await supabase.auth.signOut(); window.location.assign("/login?password=updated");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() || t("Explorer") }, emailRedirectTo: AUTH_CALLBACK_URL } });
        if (error) throw error;
        if (data.session) window.location.assign("/workspace");
        else setMessage("Check your inbox to confirm your email, then return here to sign in.");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${AUTH_CALLBACK_URL}?next=/auth/update-password` });
        if (error) throw error; setMessage("If an account exists for this email, you’ll receive a password reset link.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error; window.location.assign("/workspace");
      }
    } catch (err) { setError(authErrorKey(err)); }
    finally { setBusy(false); }
  }
  const title = local ? t("Your local atlas.") : updatePassword ? t("A fresh start.") : mode === "signup" ? t("Your perspective matters.") : mode === "reset" ? t("Find your way back.") : t("Welcome to your world.");
  return <>{confirmationError && <div className="auth-alert" role="alert">{t("Your sign-in link could not be verified. Please sign in or request a new link.")}</div>}{passwordUpdated && <div className="auth-alert success" role="status">{t("Password updated. Sign in with your new password.")}</div>}<main className="auth-page" data-auth-mode={local ? "local" : configured ? "supabase" : "unconfigured"}><section className="auth-art"><Link href="/" className="brand"><span className="brand-mark"><Globe2 size={25} /></span><span>{t("atlas")}<span className="brand-dot">.</span></span></Link><div className="auth-art-copy"><span className="eyebrow">{t("A WORLD OF PERSPECTIVES")}</span><h1>{t("Understand the world.")}<br /><em>{t("Make it your own.")}</em></h1><p>{t("People, places, and political history — connected in one personal atlas.")}</p></div><div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" /><Globe2 className="auth-globe" strokeWidth={0.45} /><div className="auth-art-footer"><span>{n(1900, { useGrouping: false })} — {n(2026, { useGrouping: false })}</span><span>{t("Explore with intention.")}</span></div></section><section className="auth-content"><div className="auth-language"><LanguageSwitcher /></div><span className="text-link auth-back"><LockKeyhole size={15} />{" " + t("Sign-in required")}</span><div className="auth-card"><div className="large-icon"><LockKeyhole size={25} /></div><h2>{title}</h2><p>{local ? t("Sign in with your local demo account. No email confirmation is needed.") : updatePassword ? t("Choose a new password for your Atlas account.") : mode === "signup" ? t("Create an account to open the map and save your discoveries.") : mode === "reset" ? t("We’ll email you a link to reset your password.") : t("Sign in to access your personal political map.")}</p>{local && <div className="info-notice local-auth-notice"><strong>{t("Local demo account")}</strong><span>{t("Your preferences, bookmarks and notes stay in this browser.")}</span></div>}{!configured && <div className="info-notice"><strong>{t("Account access isn’t available yet.")}</strong><span>{t("Registration and sign-in must be enabled before anyone can open the map.")}</span></div>}<form onSubmit={submit}>{mode === "signup" && !updatePassword && <label>{t("Display name")}<div className="input-wrap"><UserRound size={17} /><input disabled={busy} value={name} onChange={e => setName(e.target.value)} placeholder={t("How should we call you?")} maxLength={80} autoComplete="name" required /></div></label>}{!updatePassword && <label>{t("Email address")}<div className="input-wrap"><Mail size={17} /><input dir="ltr" type="email" disabled={busy} required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></div></label>}{(mode !== "reset" || updatePassword) && <label>{t("Password")}<div className="input-wrap"><LockKeyhole size={17} /><input dir="ltr" type={visible ? "text" : "password"} disabled={busy} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder={t("At least 8 characters")} autoComplete={mode === "signup" || updatePassword ? "new-password" : "current-password"} /><button type="button" className="icon-plain" aria-label={visible ? t("Hide password") : t("Show password")} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}{mode === "login" && !updatePassword && !local && <button className="text-link forgot" type="button" onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>{t("Forgot password?")}</button>}{error && <p className="form-error" role="alert">{text(error)}</p>}{message && <p className="form-success" role="status">{text(message)}</p>}<button type="submit" className="primary-button auth-submit" disabled={busy}>{busy ? t("Please wait…") : updatePassword ? t("Update password") : mode === "signup" ? t("Create your account") : mode === "reset" ? t("Send reset link") : t("Sign in to Atlas")}<ArrowRight size={17} /></button></form>{!updatePassword && !local && <p className="auth-switch">{mode === "login" ? t("New to Atlas?") : t("Already have an account?")} <button className="text-link" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? t("Create an account") : t("Sign in")}</button></p>}<div className="auth-footnote"><LockKeyhole size={13} />{" " + t("Your discoveries. Your private space.")}</div></div><span className="auth-copyright">{t("ATLAS · AN INTERACTIVE POLITICAL MAP")}</span></section></main></>;
}
