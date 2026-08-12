"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export function HrModal({ open, title, count, onClose, children, wide = false }: { open: boolean; title: string; count?: number; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; panel.current?.focus(); const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", onKey); return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); previous?.focus(); }; }, [open, onClose]);
  if (!open) return null;
  return <div className="hr-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`hr-modal ${wide ? "hr-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="hr-modal-title" tabIndex={-1} ref={panel}><header className="hr-modal-header"><h2 id="hr-modal-title">{title}{count !== undefined && <span className="hr-modal-count">{count}</span>}</h2><button type="button" onClick={onClose} aria-label={`Close ${title}`}><X /></button></header>{children}</div></div>;
}
