"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export default function ControlSection({ title, trailing, children, className = "", defaultOpen = true }: { title: ReactNode; trailing?: ReactNode; children: ReactNode; className?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <section className={`control-section ${className}`}>
    <button type="button" className="control-section-title" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><span>{title}</span><span className="control-section-heading-end">{trailing}<ChevronDown className="section-chevron" size={14} /></span></button>
    <div id={id} className="control-section-content" hidden={!open}>{children}</div>
  </section>;
}
