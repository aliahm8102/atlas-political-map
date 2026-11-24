"use client";

import { useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import type { Country, Person } from "@/lib/atlas";
import type { ActionResult } from "@/lib/administration";
import { importColumns, importLimit, importRows, planCharacterImport, type ImportEntry, type ImportMode, type ImportRow } from "@/lib/character-import";
import { downloadExport, exportFile } from "@/lib/directory-export";
import Modal from "./modal";

type Props = {
  personal: Person[]; shared: Person[]; countries: Country[]; ready: boolean;
  onPersonal: (rows: ImportRow[]) => boolean;
  onShared?: (entries: ImportEntry[]) => Promise<ActionResult<number>>;
};

export default function CharacterImport({ personal, shared, countries, ready, onPersonal, onShared }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ImportMode>("personal");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [phase, setPhase] = useState<"reading" | "saving" | "template" | null>(null);
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);
  const busy = phase !== null;
  const plan = useMemo(() => planCharacterImport(rows, mode === "shared" ? shared : personal, countries, mode), [rows, mode, shared, personal, countries]);
  const added = plan.entries.filter(entry => entry.id === null).length;
  const overLimit = mode === "personal" && personal.length + added > importLimit;

  async function read(file: File) {
    setError(""); setRows([]); setCount(0);
    if (!/\.xlsx$/i.test(file.name) || file.size > 2 * 1024 * 1024) { setError(t("Choose an XLSX file up to 2 MB.")); return; }
    setPhase("reading");
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const records = importRows(await readSheet(file, 1));
      if (records === null) setError(t("Use the sample workbook headers with id in the first column."));
      else if (!records.length || records.length > importLimit) setError(t("The first worksheet must contain between 1 and 200 characters."));
      else setRows(records);
    } catch { setError(t("The XLSX file could not be read.")); }
    finally { setPhase(null); }
  }

  async function sample() {
    setError(""); setPhase("template");
    try {
      const country = countries.find(item => item.code === "364") ?? countries[0];
      const rows = country ? [[null, "Sample character", "Sample role description", "member", country.code]] : [];
      downloadExport(await exportFile({ title: "Characters", headers: [...importColumns], rows, rtl: false }, "xlsx"), "atlas-character-import.xlsx");
    } catch { setError(t("The export could not be created. Please try again.")); }
    finally { setPhase(null); }
  }

  async function save() {
    if (!ready || busy || !plan.entries.length || plan.issues.length || overLimit) return;
    setPhase("saving"); setError("");
    try {
      if (mode === "shared" && onShared) {
        const result = await onShared(plan.entries);
        if (!result.ok) { setError(t(result.error)); return; }
      } else if (mode !== "personal" || !onPersonal(rows)) { setError(t("The import could not be saved. Check that the IDs are still available and try again.")); return; }
      setCount(plan.entries.length); setRows([]);
    } catch { setError(t("The import could not be saved. Check that the IDs are still available and try again.")); }
    finally { setPhase(null); }
  }

  return <>
    <button type="button" className="secondary-button character-import-button" disabled={!ready} onClick={() => { setOpen(true); setCount(0); }}>
      <Upload size={16} />{t("Import XLSX")}
    </button>
    {open && <Modal title={t("Import characters")} onClose={() => setOpen(false)} className="character-import-modal">
      <div className="character-form">
        {onShared && <label>{t("Import destination")}<select className="soft-input" value={mode} disabled={busy} onChange={event => { setMode(event.target.value as ImportMode); setCount(0); setError(""); }}>
          <option value="personal">{t("My characters")}</option><option value="shared">{t("Shared characters")}</option>
        </select></label>}
        <details className="character-import-help"><summary>{t("Import guide")}</summary>
          <p className="field-hint">{t("Use the first worksheet and keep the sample column names. Leave id blank to add a character. To update, use an ID from the selected destination.")}</p>
          <p className="field-hint">{t("The required fields are name, title, role and countryCode. Empty or unusable optional values keep the existing value or use a default.")}</p>
          <p className="field-hint" dir="ltr">role: leader · member · army · religious · business<br />startDate / endDate: YYYY-MM</p>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => void sample()}><Download size={16} />{t("Download sample XLSX")}</button>
        </details>
        <label>{t("Choose XLSX file")}<input className="soft-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy}
          onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void read(file); }} /></label>
        {phase === "reading" && <p role="status">{t("Checking workbook…")}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {overLimit && <p className="form-error" role="alert">{t("This import would exceed 200 personal characters.")}</p>}
        {plan.issues.length > 0 && <div className="form-error" role="alert">
          <p>{t("Fix the listed rows before importing. IDs must be unique and belong to the selected destination.")}</p>
          <ul className="character-import-issues">{plan.issues.map(({ row, field }) => <li key={`${row}:${field}`}>{t("Row {row}, field {field}", { row, field })}</li>)}</ul>
        </div>}
        {plan.entries.length > 0 && !plan.issues.length && <p role="status">{t("{added} new and {updated} updated characters ready to import.", { added, updated: plan.entries.length - added })}</p>}
        {count > 0 && <p className="form-success" role="status">{t("Imported {count} characters.", { count })}</p>}
        <button type="button" className="primary-button" onClick={() => void save()} disabled={busy || !ready || overLimit || !plan.entries.length || plan.issues.length > 0}>
          {t(phase === "saving" ? "Saving…" : "Apply import")}
        </button>
      </div>
    </Modal>}
  </>;
}
