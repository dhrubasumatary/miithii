'use client';

import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import Link from 'next/link';

interface BalanceData {
  credits: number;
}

export function CreditBadge() {
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch('/api/credits/balance');
        if (res.ok) {
          const data: BalanceData = await res.json();
          setCredits(data.credits);
        }
      } catch {
        // silently fail — badge stays invisible
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (credits === null) return null;

  if (credits === 0) {
    return (
      <Link
        href="/credits"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e879f9] bg-[#e879f9]/10 px-3 py-1.5 text-sm font-medium text-[#e879f9] hover:bg-[#e879f9]/20 transition-colors"
      >
        <Coins className="w-3.5 h-3.5" />
        Get credits
      </Link>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#1a1a1a] bg-[#111] px-3 py-1.5 text-sm text-[#a3a3a3]">
      <Coins className="w-3.5 h-3.5 text-[#e879f9]" />
      <span>
        <span className="font-medium text-white">{credits.toLocaleString()}</span>{' '}
        cr
      </span>
    </div>
  );
}