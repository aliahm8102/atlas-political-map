"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import type { ExportFormat, ExportTable } from "@/lib/directory-export";

export default function DirectoryExport({ count, filename, table, allowReimport = false }: { count: number; filename: string; table: (importable: boolean) => ExportTable; allowReimport?: boolean }) {
  const { t } = useI18n();
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importable, setImportable] = useState(false);
  async function download() {
    if (busy || !count) return;
    setBusy(true); setError("");
    try {
      const { downloadExport, exportFile } = await import("@/lib/directory-export");
      downloadExport(await exportFile(table(allowReimport && format === "xlsx" && importable), format), `${filename}.${format}`);
    } catch { setError(t("The export could not be created. Please try again.")); }
    finally { setBusy(false); }
  }
  return <div className="directory-export">
    <p className="field-hint">{t("Export the current filtered list.")}</p>
    <div className="directory-export-actions"><label>{t("File format")}<select className="soft-input" aria-label={t("Export format")} value={format} disabled={busy} onChange={event => setFormat(event.target.value as ExportFormat)}><option value="xlsx">XLSX</option><option value="csv">CSV</option><option value="txt">TXT</option></select></label>
      {allowReimport && format === "xlsx" && <label className="directory-reimport"><input type="checkbox" checked={importable} disabled={busy} onChange={event => setImportable(event.target.checked)} />{t("Allow re-import")}</label>}
      <button type="button" className="secondary-button" data-directory-export disabled={busy || !count} onClick={() => void download()}><Download size={17} />{t(busy ? "Preparing download…" : "Download list")}</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
