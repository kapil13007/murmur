// File: src/Onboarding/components/ShortcutStep.jsx
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { desktop } from '../../desktop/bridge';
import KeyCombo from '../../components/ui/KeyCombo';

export default function ShortcutStep() {
  const { preferences, isDesktop } = useApp();
  const [pressed, setPressed] = useState(false);

  // The desktop app reports when the push-to-talk keys go down.
  useEffect(() => desktop?.onHotkey?.((event) => event === 'push_to_talk' && setPressed(true)), []);

  return (
    <div className="rounded-2xl border border-line bg-panel px-6 py-8 text-center">
      <KeyCombo keys={preferences?.shortcuts?.push_to_talk} size="lg" className="justify-center" />
      <p className="mt-4 text-sm text-muted">Hold to dictate · double-check it doesn&apos;t clash with shortcuts you use.</p>
      {isDesktop ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink">
          {pressed ? (
            <>
              <CheckCircle2 size={16} className="text-fathom-700" /> Nice — Murmur heard your shortcut.
            </>
          ) : (
            'Try pressing it now.'
          )}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">Shortcuts work everywhere once the Murmur desktop app is running. You can change them in Settings &gt; General.</p>
      )}
    </div>
  );
}
