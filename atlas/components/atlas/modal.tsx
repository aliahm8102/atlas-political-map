"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
export default function Modal({ title, children, onClose, className = "" }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null); const id = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`atlas-modal ${className}`} aria-labelledby={id} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-inner"><header><h2 id={id}>{title}</h2><button className="icon-button" aria-label={t("Close dialog")} onClick={onClose}><X size={18} /></button></header>{children}</div></dialog>;
}
