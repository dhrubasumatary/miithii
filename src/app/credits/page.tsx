'use client';

import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, Zap } from 'lucide-react';
import { formatINR } from '@/lib/utils';

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  badge?: string;
  badgeColor?: string;
  description: string;
  popular?: boolean;
}

const PACKS: CreditPack[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 1000,
    price: 1900,
    description: 'Perfect for trying out Miithii',
  },
  {
    id: 'standard',
    name: 'Standard',
    credits: 3000,
    price: 4900,
    badge: 'Most Popular',
    badgeColor: 'bg-accent/20 text-accent border-accent/40',
    description: 'Best value for regular users',
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    credits: 15000,
    price: 19900,
    badge: 'Best Value',
    badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    description: 'Maximum savings for power users',
  },
];

type CheckoutState = 'idle' | 'loading' | 'success' | 'error';

export default function CreditsPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [razorpayReady, setRazorpayReady] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayReady(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    fetch('/api/credits/balance')
      .then((r) => r.json())
      .then((d) => setBalance(d.credits ?? 0))
      .catch(() => setBalance(0));
  }, []);

  async function handleBuy(pack: CreditPack) {
    if (!razorpayReady) return;
    setCheckoutState('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to create order');
      }

      const order = await res.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: 'INR',
        name: 'Miithii',
        description: `${order.credits} Credits`,
        order_id: order.orderId,
        handler: async (response: Record<string, string>) => {
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });

          if (verifyRes.ok) {
            setCheckoutState('success');
            // Refresh balance
            const balanceRes = await fetch('/api/credits/balance');
            const balanceData = await balanceRes.json();
            setBalance(balanceData.credits ?? 0);
          } else {
            setCheckoutState('error');
            setErrorMsg('Payment verification failed');
          }
        },
        prefill: {
          email: user?.primaryEmailAddress?.emailAddress ?? '',
        },
        theme: {
          color: '#e879f9',
        },
      };

      const rzp = new ((window as unknown) as { Razorpay: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay(options);
      rzp.open();
      setCheckoutState('idle');
    } catch (err) {
      setCheckoutState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header gradient */}
      <div className="bg-gradient-radial h-64" />

      <div className="max-w-4xl mx-auto px-4 -mt-32 pb-24">
        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-1.5 mb-4">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted">Power your conversations</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Buy Credits</span>
          </h1>
          <p className="text-muted text-lg max-w-md mx-auto">
            Scale your AI conversations with affordable credit packs.
          </p>
          {balance !== null && (
            <div className="mt-4 inline-flex items-center gap-2 bg-surface border border-border rounded-lg px-4 py-2">
              <span className="text-muted text-sm">Current balance</span>
              <span className="text-accent font-semibold text-lg">
                {balance.toLocaleString('en-IN')} credits
              </span>
            </div>
          )}
        </motion.div>

        {/* Success state */}
        {checkoutState === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <p className="text-success font-medium">
              Payment successful! Your credits have been added.
            </p>
          </motion.div>
        )}

        {/* Error state */}
        {checkoutState === 'error' && errorMsg && (
          <div className="mb-8 bg-danger/10 border border-danger/30 rounded-xl p-4">
            <p className="text-danger font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Credit packs */}
        <div className="grid md:grid-cols-3 gap-6">
          {PACKS.map((pack, i) => (
            <motion.div
              key={pack.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative group"
            >
              {/* Gradient border */}
              <div
                className={`
                  absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100
                  bg-gradient-to-br from-accent via-purple-500 to-fuchsia-500
                  transition-opacity duration-300 blur-sm
                `}
              />
              <div className="relative bg-surface border border-border rounded-2xl p-6 flex flex-col h-full">
                {/* Badge */}
                {pack.badge && (
                  <span
                    className={`inline-flex self-start text-xs font-medium px-2.5 py-0.5 rounded-full border mb-3 ${pack.badgeColor}`}
                  >
                    {pack.badge}
                  </span>
                )}

                {/* Pack name & price */}
                <div className="mb-4">
                  <h3 className="text-xl font-semibold mb-1">{pack.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-accent">
                      {formatINR(pack.price / 100)}
                    </span>
                  </div>
                </div>

                {/* Credits count */}
                <div className="mb-4 bg-background rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-gradient">
                    {pack.credits.toLocaleString('en-IN')}
                  </div>
                  <div className="text-sm text-muted mt-0.5">credits</div>
                </div>

                <p className="text-muted text-sm mb-6 flex-1">{pack.description}</p>

                {/* Buy button */}
                <button
                  onClick={() => handleBuy(pack)}
                  disabled={checkoutState === 'loading' || !razorpayReady}
                  className={`
                    w-full py-3 rounded-xl font-semibold transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                    bg-accent hover:bg-accent-hover text-background
                    flex items-center justify-center gap-2
                  `}
                >
                  {checkoutState === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    'Buy Now'
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Conversion note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-muted text-sm mt-8"
        >
          Each credit = ~20 tokens. No subscriptions, pay only for what you use.
        </motion.p>
      </div>
    </div>
  );
}