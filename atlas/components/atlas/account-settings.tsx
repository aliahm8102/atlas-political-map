"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Check, ImagePlus, LockKeyhole, LogOut, UsersRound, X } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { initials } from "@/lib/atlas";
import { localPortrait } from "@/lib/local-portrait";

export function AccountAvatar({ name, photo, large = false }: { name: string; photo: string; large?: boolean }) {
  return <span className={large ? "avatar big" : "avatar"} aria-hidden="true">
    {photo ? <Image src={photo} alt="" width={large ? 48 : 36} height={large ? 48 : 36} unoptimized /> : initials(name)}
  </span>;
}

type Props = {
  mode: "local" | "account"; email?: string; displayName: string; photo: string; ready: boolean;
  onSaveName: (name: string) => Promise<boolean>; onPhoto: (photo: string) => boolean; onSignOut: () => void;
};

export default function AccountSettings({ mode, email, displayName, photo, ready, onSaveName, onPhoto, onSignOut }: Props) {
  const { t } = useI18n();
  const photoInput = useRef<HTMLInputElement>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const name = nameDraft ?? displayName;

  async function uploadPhoto(file?: File) {
    if (!file) return;
    setProcessing(true);
    setPhotoError("");
    try { onPhoto(await localPortrait(file)); }
    catch { setPhotoError(t("Choose a PNG, JPEG or WebP image smaller than 5 MB.")); }
    finally { setProcessing(false); }
  }

  return <div className="settings-grid">
    <section className="settings-card">
      <div className="settings-card-heading"><span className="large-icon"><UsersRound size={23} /></span><h2>{t("Your profile")}</h2></div>
      <div className="profile-preview">
        <AccountAvatar name={displayName} photo={photo} large />
        <div><strong>{displayName}</strong><span><bdi>{email || t("Local demo explorer")}</bdi></span></div>
        <span className="account-badge">{mode === "local" ? t("Demo") : t("Personal")}</span>
      </div>
      <div className="profile-photo-actions">
        <input ref={photoInput} name="profile-photo" type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={!ready || processing}
          onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void uploadPhoto(file); }} />
        <button type="button" className="secondary-button" disabled={!ready || processing} onClick={() => photoInput.current?.click()}>
          <ImagePlus size={15} />{t(processing ? "Preparing portrait…" : "Choose profile photo")}
        </button>
        {photo && <button type="button" className="text-link" disabled={processing} onClick={() => { setPhotoError(""); onPhoto(""); }}><X size={15} />{t("Remove profile photo")}</button>}
      </div>
      <p className="field-hint">{t("Your profile photo is saved in this browser.")}</p>
      {photoError && <p className="form-error" role="alert">{photoError}</p>}
      <form onSubmit={async event => {
        event.preventDefault();
        if (!name.trim() || saving) return;
        setSaving(true);
        try { if (await onSaveName(name.trim())) setNameDraft(null); }
        finally { setSaving(false); }
      }}>
        <label className="form-label" htmlFor="display-name">{t("Display name")}</label>
        <input className="soft-input" id="display-name" dir="auto" value={name} onChange={event => setNameDraft(event.target.value)} maxLength={80} required disabled={saving} />
        <button className="primary-button" disabled={saving || !name.trim() || name.trim() === displayName}>{t(saving ? "Saving…" : "Save profile")}<Check size={15} /></button>
      </form>
    </section>
    <section className="settings-card">
      <div className="settings-card-heading"><span className="large-icon"><LockKeyhole size={23} /></span><h2>{t("Your private workspace")}</h2></div>
      <div className="account-info"><div>
        <p>{mode === "local" ? t("Preferences, notes and bookmarks are saved in this browser. Your local account works without email confirmation.") : t("Your preferences, notes and bookmarks belong to your account.")}</p>
        <button type="button" className="text-link" onClick={onSignOut}><LogOut size={14} />{t("Sign out")}</button>
      </div></div>
    </section>
  </div>;
}
