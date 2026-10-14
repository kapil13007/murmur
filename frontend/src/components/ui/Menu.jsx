// File: src/components/ui/Menu.jsx
// Small dropdown menu anchored to its trigger.
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

export default function Menu({ trigger, items, align = 'right', width = 'w-56', onOpenChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Parents can react to the menu opening (e.g. keep a hover toolbar visible).
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });
  useEffect(() => {
    onOpenChangeRef.current?.(open);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={clsx(
            'absolute z-40 mt-1 animate-pop-in rounded-xl bg-panel p-1 shadow-pop',
            width,
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.filter(Boolean).map((item, i) =>
            item.divider ? (
              <div key={`d${i}`} className="my-1 h-px bg-line" />
            ) : item.heading ? (
              <div key={item.heading} className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                {item.heading}
              </div>
            ) : (
              <button
                key={item.label}
                disabled={item.disabled}
                title={item.title}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition disabled:opacity-40',
                  item.danger ? 'text-flare-500 hover:bg-flare-50 dark:hover:bg-flare-600/20' : 'text-ink hover:bg-subtle',
                  item.active && 'font-semibold',
                )}
              >
                {item.icon && <item.icon size={15} className="shrink-0 opacity-70" />}
                <span className="flex-1">{item.label}</span>
                {item.active && <span className="text-xs">✓</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
