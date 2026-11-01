import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CURRENCY } from '../economy/rewards';

// ─── Toasts ────────────────────────────────────────────────────────────────────
interface Toast { id: number; text: string; tone: 'info' | 'error' | 'success' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className={`pointer-events-auto max-w-md rounded-2xl px-4 py-2.5 text-sm font-bold shadow-card ${t.tone === 'error' ? 'bg-red-500 text-white' : t.tone === 'success' ? 'bg-mint-400 text-[#10291f]' : 'bg-cone-100 text-cone-800'}`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

// ─── Modal / confirm ───────────────────────────────────────────────────────────
export function Modal({ open, onClose, children, wide = false, bare = false }: { open: boolean; onClose?: () => void; children: ReactNode; wide?: boolean; bare?: boolean }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className={bare ? 'max-h-full overflow-auto' : `max-h-full w-full overflow-auto rounded-3xl border border-white/10 bg-[#2f1b12] p-5 shadow-card ${wide ? 'max-w-4xl' : 'max-w-md'}`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Confirm({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: { open: boolean; title: string; body?: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} onClose={onCancel}>
      <h3 className="font-display text-2xl font-extrabold">{title}</h3>
      {body && <div className="mt-2 text-sm text-white/75">{body}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

// ─── Small pieces ──────────────────────────────────────────────────────────────
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-white/70">
      <motion.div className="h-10 w-10 rounded-full border-4 border-berry-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} />
      {label && <span className="text-sm font-bold">{label}</span>}
    </div>
  );
}

export function ScoopIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M7 12 L12 23 L17 12Z" fill="#e9b06d" stroke="#8f511c" strokeWidth="1" />
      <circle cx="12" cy="9" r="6.5" fill="#ff8cc6" /><circle cx="8" cy="11" r="3.5" fill="#ff6fb5" /><circle cx="16" cy="11" r="3.5" fill="#ff6fb5" />
      <circle cx="12" cy="3.3" r="1.7" fill="#e0204a" />
    </svg>
  );
}

export function Scoops({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-display font-extrabold ${className}`} title={CURRENCY.name}>
      <ScoopIcon /> {n.toLocaleString()}
    </span>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-2xl font-extrabold tracking-tight">{children}</h2>
      {right}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-2 p-8 text-center">
      <ScoopIcon size={36} />
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="text-sm text-white/70">{children}</div>}
    </div>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-berry-300 to-cone-300 ring-2 ring-white/20" style={{ width: size, height: size }}>
      <img src={`/art/creatures/${name}.webp`} alt="" className="h-[85%] w-[85%] object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
    </span>
  );
}
