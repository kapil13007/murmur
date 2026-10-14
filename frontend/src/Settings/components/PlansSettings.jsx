// File: src/Settings/components/PlansSettings.jsx
// Plans and Billing. Checkout is a demo: nothing is charged.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, GraduationCap } from 'lucide-react';
import clsx from 'clsx';
import * as api from '../../api/apiClient';
import { useApp } from '../../context/AppContext';
import { formatDate, formatMoney, formatNumber } from '../../utils/formatter';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { PageSpinner } from '../../components/ui/Spinner';
import CheckoutModal from './CheckoutModal';
import { SettingSection } from './SettingRow';

const EVENT_LABELS = {
  trial_started: 'Pro trial started',
  trial_ended: 'Pro trial ended',
  trial_canceled: 'Pro trial canceled',
  payment_succeeded: 'Payment',
  cancel_scheduled: 'Cancellation scheduled',
  cancel_reverted: 'Subscription resumed',
  subscription_ended: 'Subscription ended',
  student_plan_claimed: 'Student plan claimed',
  free_month_granted: 'Free month',
};

export default function PlansSettings() {
  const { setSubscription } = useApp();
  const [plans, setPlans] = useState([]);
  const [state, setState] = useState(null);
  const [history, setHistory] = useState([]);
  const [billingInterval, setBillingInterval] = useState('year');
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([api.getPlans(), api.getSubscription(), api.getBillingHistory()]).then(([p, s, h]) => {
        setPlans(p);
        setState(s);
        setHistory(h);
        setSubscription(s.subscription);
      }),
    [setSubscription],
  );

  useEffect(() => {
    load().catch((err) => toast.error(api.errorMessage(err)));
  }, [load]);

  if (!state) return <PageSpinner />;
  const { subscription: sub, usage } = state;

  const act = async (fn, message) => {
    try {
      await fn();
      toast.success(message);
      await load();
    } catch (err) {
      toast.error(api.errorMessage(err));
    }
  };

  const currentLabel = sub.is_trial
    ? `Pro Trial · ${sub.trial_days_left} day${sub.trial_days_left === 1 ? '' : 's'} left`
    : sub.is_student
      ? 'Pro for Students'
      : sub.is_pro
        ? `Flow ${sub.plan_name} · ${sub.billing_interval === 'year' ? 'Annual' : 'Monthly'}`
        : 'Flow Basic';

  return (
    <div>
      <div className="mt-2 rounded-2xl bg-gradient-to-r from-dawn-300 to-fathom-50 p-5 dark:from-vast-800 dark:to-vast-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current plan</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-3xl text-ink">{currentLabel}</p>
          <div className="flex gap-2">
            {sub.is_pro && sub.cancel_at_period_end && (
              <button className="btn-primary" onClick={() => act(api.resumeSubscription, 'Subscription resumed')}>
                Resume subscription
              </button>
            )}
            {(sub.is_trial || (sub.status === 'active' && !sub.cancel_at_period_end)) && (
              <button className="btn-secondary" onClick={() => setConfirmCancel(true)}>
                {sub.is_trial ? 'End trial' : 'Cancel plan'}
              </button>
            )}
          </div>
        </div>
        {sub.status === 'active' && sub.current_period_end && (
          <p className="mt-1 text-sm text-muted">
            {sub.cancel_at_period_end ? 'Ends' : 'Renews'} on {formatDate(sub.current_period_end)}
          </p>
        )}
        {!usage.is_unlimited && (
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-ink">
                <span className="font-semibold">{formatNumber(usage.remaining)}</span> words left this week
              </span>
              <span className="text-muted">Limit resets {formatDate(usage.resets_at, { weekday: 'long' })}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel">
              <div className="h-full rounded-full bg-fathom-700" style={{ width: `${Math.min(100, (usage.words_used / usage.limit) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="section-label">Plans</p>
        <div className="flex rounded-xl border border-line p-0.5 text-sm">
          {['month', 'year'].map((i) => (
            <button key={i} onClick={() => setBillingInterval(i)} className={clsx('rounded-lg px-3 py-1', billingInterval === i ? 'bg-subtle font-semibold text-ink' : 'text-muted')}>
              {i === 'month' ? 'Monthly' : 'Annual · save 20%'}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === sub.plan && (sub.status === 'active' || (plan.id === 'FLOW_BASIC' && !sub.is_pro));
          const price = plan.price_cents[billingInterval];
          const monthly = billingInterval === 'year' ? price / 12 : price;
          return (
            <div key={plan.id} className={clsx('flex flex-col rounded-2xl border p-5', plan.id === 'FLOW_PRO' ? 'border-ink' : 'border-line')}>
              <p className="font-semibold text-ink">{plan.name}</p>
              <p className="text-xs text-muted">{plan.tagline}</p>
              <p className="mt-3 font-display text-4xl text-ink">
                {price === 0 ? 'Free' : formatMoney(Math.round(monthly))}
                {price > 0 && <span className="ml-1 font-sans text-sm text-muted">/{plan.per_seat ? 'user/' : ''}mo</span>}
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-ink">
                    <Check size={15} className="mt-0.5 shrink-0 text-fathom-700" /> {f}
                  </li>
                ))}
              </ul>
              {plan.id === 'FLOW_BASIC' ? (
                <button className="btn-secondary mt-5" disabled>
                  {isCurrent ? 'Current plan' : 'Included'}
                </button>
              ) : (
                <button className={clsx('mt-5', plan.id === 'FLOW_PRO' ? 'btn-primary' : 'btn-secondary')} disabled={isCurrent} onClick={() => setCheckoutPlan(plan)}>
                  {isCurrent ? 'Current plan' : `Get ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!sub.is_student && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="text-dawn-700" />
            <div>
              <p className="text-sm font-semibold text-ink">Free unlimited access for students</p>
              <p className="text-xs text-muted">Save money and just flow — no credit card required.</p>
            </div>
          </div>
          <button className="btn-secondary shrink-0" onClick={() => act(api.claimStudentPlan, 'Student plan activated for a year')}>
            Claim for free
          </button>
        </div>
      )}

      <SettingSection title="Billing history">
        {history.length ? (
          history.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <p className="text-sm text-ink">{EVENT_LABELS[e.event_type] || e.event_type}</p>
                <p className="text-xs text-muted">{e.description}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-ink">{e.amount_cents ? formatMoney(e.amount_cents, e.currency) : '—'}</p>
                <p className="text-xs text-faint">{formatDate(e.created_at)}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="px-5 py-4 text-sm text-muted">No billing activity yet.</p>
        )}
      </SettingSection>

      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          interval={billingInterval}
          onClose={() => setCheckoutPlan(null)}
          onDone={async () => {
            setCheckoutPlan(null);
            await load();
          }}
        />
      )}
      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        confirmLabel={sub.is_trial ? 'End trial' : 'Cancel plan'}
        title={sub.is_trial ? 'End your Pro trial?' : 'Cancel your subscription?'}
        message={
          sub.is_trial
            ? `You'll move to Flow Basic right away, with ${formatNumber(plans[0]?.weekly_word_limit)} words per week.`
            : `You keep Pro until ${formatDate(sub.current_period_end)}, then move to Flow Basic.`
        }
        onConfirm={() => act(api.cancelSubscription, sub.is_trial ? 'Trial ended' : 'Cancellation scheduled')}
      />
    </div>
  );
}
