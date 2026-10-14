// File: src/Onboarding/Onboarding.jsx
// First-run setup, modelled on Wispr Flow's onboarding pages.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { completeOnboarding, errorMessage } from '../api/apiClient';
import { useApp } from '../context/AppContext';
import Logo from '../components/Logo';
import ChipGroup from './components/ChipGroup';
import MicStep from './components/MicStep';
import PrivacyStep from './components/PrivacyStep';
import ShortcutStep from './components/ShortcutStep';
import TryItStep from './components/TryItStep';
import { LANGUAGES } from '../utils/languages';

const ROLES = ['Student', 'Engineer', 'Founder', 'Product', 'Designer', 'Sales', 'Marketing', 'Support', 'Writer', 'Other'];
const LOCATIONS = [
  ['sending_messages', 'Sending messages'],
  ['drafting_emails', 'Drafting emails'],
  ['writing_documents', 'Writing documents'],
  ['chatting_with_ai', 'Chatting with AI'],
  ['coding_with_ai', 'Coding with AI'],
  ['taking_notes', 'Taking notes'],
  ['writing_posts', 'Writing posts'],
];
const STEPS = ['welcome', 'about', 'typing', 'privacy', 'mic', 'language', 'shortcut', 'try', 'done'];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState([]);
  const [locations, setLocations] = useState([]);
  const [languages, setLanguages] = useState(['en']);
  const [busy, setBusy] = useState(false);
  const current = STEPS[step];

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    setBusy(true);
    try {
      const res = await completeOnboarding({
        product_intent: 'dictation',
        role: role[0]?.toLowerCase(),
        writing_needs: locations,
        typing_locations: locations,
        selected_languages: languages,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setUser(res.user);
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const continueButton = (label = 'Continue', disabled = false) => (
    <button className="btn-primary px-6 py-2.5" onClick={next} disabled={disabled}>
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between px-8 py-6">
        <Logo />
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className={clsx('h-1.5 rounded-full transition-all', i <= step ? 'w-6 bg-ink' : 'w-1.5 bg-vast-200')} />
          ))}
        </div>
        <span className="w-20" />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div key={current} className="w-full max-w-xl animate-pop-in">
          {current === 'welcome' && (
            <div className="text-center">
              <p className="font-display text-[56px] leading-[1.05] text-ink">
                Welcome to Flow,
                <br />
                <span className="italic">{user?.first_name}</span>
              </p>
              <p className="mx-auto mt-4 max-w-md text-muted">Write four times faster with your voice — in Slack, Gmail, Notion, ChatGPT and every other app. Let&apos;s get you set up in two minutes.</p>
              <div className="mt-8">{continueButton('Get started')}</div>
            </div>
          )}

          {current === 'about' && (
            <Step title="Tell us about yourself" subtitle="What do you do for work?">
              <ChipGroup options={ROLES.map((r) => [r, r])} value={role} onChange={setRole} single />
              <Footer back={back}>{continueButton('Continue', !role.length)}</Footer>
            </Step>
          )}

          {current === 'typing' && (
            <Step title="Where do you spend time typing?" subtitle="This helps us personalize Flow where you work. Select all that apply.">
              <ChipGroup options={LOCATIONS} value={locations} onChange={setLocations} />
              <Footer back={back}>{continueButton('Continue', !locations.length)}</Footer>
            </Step>
          )}

          {current === 'privacy' && (
            <Step title="Your data, your choice" subtitle="Choose how Flow stores your dictations. You can change this any time in Settings.">
              <PrivacyStep />
              <Footer back={back}>{continueButton()}</Footer>
            </Step>
          )}

          {current === 'mic' && (
            <Step title="Let's check your microphone" subtitle="Say something — the bar should move as you speak.">
              <MicStep />
              <Footer back={back}>{continueButton('Sounds good')}</Footer>
            </Step>
          )}

          {current === 'language' && (
            <Step title="Which languages do you speak?" subtitle="Pick the languages you'll dictate in. Choosing one gives the best accuracy.">
              <ChipGroup options={LANGUAGES.slice(0, 18).map((l) => [l.code, l.name])} value={languages} onChange={setLanguages} />
              <p className="mt-3 text-xs text-muted">More languages (or auto-detect) are available in Settings &gt; General.</p>
              <Footer back={back}>{continueButton('Continue', !languages.length)}</Footer>
            </Step>
          )}

          {current === 'shortcut' && (
            <Step title="Your dictation shortcut" subtitle="Hold the keys, speak, and let go. Flow types for you wherever your cursor is.">
              <ShortcutStep />
              <Footer back={back}>{continueButton()}</Footer>
            </Step>
          )}

          {current === 'try' && (
            <Step title="Try it yourself" subtitle="Reply to this message by voice. Make a mistake on purpose and correct yourself.">
              <TryItStep />
              <Footer back={back}>{continueButton('Next')}</Footer>
            </Step>
          )}

          {current === 'done' && (
            <div className="text-center">
              <p className="font-display text-[48px] leading-tight text-ink">You&apos;re all set.</p>
              <p className="mx-auto mt-3 max-w-md text-muted">
                Most people type around 40 words per minute and speak at over 150. That&apos;s hours back every week.
              </p>
              <div className="mx-auto mt-8 grid max-w-sm grid-cols-2 gap-3 text-left">
                <div className="card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Typing</p>
                  <p className="font-display text-3xl text-ink">40 WPM</p>
                </div>
                <div className="rounded-2xl border border-ink bg-raised p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">With Flow</p>
                  <p className="font-display text-3xl text-ink">150+ WPM</p>
                </div>
              </div>
              <button className="btn-primary mt-8 px-8 py-2.5" onClick={finish} disabled={busy}>
                {busy ? 'Finishing…' : 'Start using Flow'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Step({ title, subtitle, children }) {
  return (
    <div>
      <h1 className="font-display text-[40px] leading-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Footer({ back, children }) {
  return (
    <div className="mt-10 flex items-center justify-between">
      <button className="btn-ghost" onClick={back}>
        <ArrowLeft size={15} /> Back
      </button>
      {children}
    </div>
  );
}
