// File: src/Onboarding/components/TryItStep.jsx
// A mock chat where the user replies by voice (mic button in the browser, or
// the global shortcut in the desktop app, which pastes into the textbox).
import { useState } from 'react';
import DictateButton from '../../components/DictateButton';

export default function TryItStep() {
  const [reply, setReply] = useState('');
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="border-b border-line px-5 py-3 text-sm font-semibold text-ink"># general</div>
      <div className="space-y-4 px-5 py-5">
        <div className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-glow-100 text-sm font-semibold text-glow-500">S</span>
          <div>
            <p className="text-sm font-semibold text-ink">
              Sam <span className="text-xs font-normal text-faint">10:42 AM</span>
            </p>
            <p className="text-sm text-ink">When can you send over the launch checklist?</p>
          </div>
        </div>
        <p className="rounded-xl bg-subtle px-4 py-3 text-sm text-muted">
          Try saying: <span className="italic text-ink">&ldquo;Um, I can send it by 3 pm, actually make it 4 pm. Thanks!&rdquo;</span>
        </p>
      </div>
      <div className="flex items-end gap-2 border-t border-line p-3">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Message #general"
          className="input min-h-[44px] flex-1 resize-none"
          rows={2}
        />
        <DictateButton appName="Slack" onText={(text) => setReply((r) => (r ? `${r} ${text}` : text))} />
      </div>
    </div>
  );
}
