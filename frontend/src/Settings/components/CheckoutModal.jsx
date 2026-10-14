// File: src/Settings/components/CheckoutModal.jsx
// Demo checkout: card details never leave the browser except the last four
// digits, which are stored on the billing record for display.
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import { checkout, errorMessage } from '../../api/apiClient';
import { formatMoney } from '../../utils/formatter';
import Modal from '../../components/ui/Modal';

export default function CheckoutModal({ plan, interval, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', card: '', expiry: '', cvc: '', seats: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const digits = form.card.replace(/\D/g, '');
  const total = plan.price_cents[interval] * (plan.per_seat ? Number(form.seats) || 1 : 1);

  const submit = async (e) => {
    e.preventDefault();
    if (digits.length < 12) return setError('Enter a card number (any test number works).');
    setBusy(true);
    setError('');
    try {
      await checkout({
        plan: plan.id,
        interval,
        seats: Number(form.seats) || 1,
        cardholder_name: form.name.trim(),
        card_last4: digits.slice(-4),
      });
      toast.success(`Welcome to Flow ${plan.name}!`);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Upgrade to ${plan.name}`} subtitle={`${formatMoney(total)} billed ${interval === 'year' ? 'yearly' : 'monthly'}`}>
      <p className="mb-4 rounded-xl bg-glow-50 px-3 py-2 text-xs text-glow-500 dark:bg-vast-800 dark:text-glow-200">
        Demo checkout — no payment processor is connected and nothing is charged.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label" htmlFor="cc-name">Name on card</label>
          <input id="cc-name" className="input" autoComplete="cc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="label" htmlFor="cc-number">Card number</label>
          <input
            id="cc-number"
            className="input font-mono"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            value={form.card}
            onChange={(e) => setForm({ ...form, card: e.target.value.replace(/[^\d ]/g, '').slice(0, 23) })}
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="cc-exp">Expiry</label>
            <input id="cc-exp" className="input" placeholder="12/30" autoComplete="cc-exp" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value.slice(0, 5) })} required />
          </div>
          <div>
            <label className="label" htmlFor="cc-cvc">CVC</label>
            <input id="cc-cvc" className="input" placeholder="123" autoComplete="cc-csc" value={form.cvc} onChange={(e) => setForm({ ...form, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} required />
          </div>
          {plan.per_seat && (
            <div>
              <label className="label" htmlFor="seats">Seats</label>
              <input id="seats" type="number" min={1} max={500} className="input" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
            </div>
          )}
        </div>
        {error && <p className="text-sm text-flare-500">{error}</p>}
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
          <Lock size={14} /> {busy ? 'Processing…' : `Pay ${formatMoney(total)}`}
        </button>
      </form>
    </Modal>
  );
}
