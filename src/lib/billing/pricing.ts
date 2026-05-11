export const INR_PER_USD = 85;
export const INTERNAL_COST_INR_PER_MINUTE = 4;
export const RAZORPAY_DOMESTIC_FEE_RATE = 0.0236;
export const FREE_TRIAL_MINUTES = 3;
export const TRIAL_MAX_GENERATION_MINUTES = 1;

export type CreditPack = {
  id: string;
  name: string;
  priceInr: number;
  minutes: number;
  active: boolean;
  badge?: string;
  description: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  priceInr: number;
  monthlyMinutes: number;
  description: string;
};

export const launchCreditPacks = [
  {
    id: "try",
    name: "Test",
    priceInr: 9,
    minutes: 1,
    active: true,
    badge: "First export",
    description: "One small Assamese voice test before you trust it.",
  },
  {
    id: "starter",
    name: "Reels",
    priceInr: 29,
    minutes: 4,
    active: true,
    badge: "Easy UPI",
    description: "A few short reels, explainers, or classroom clips.",
  },
  {
    id: "creator",
    name: "Creator",
    priceInr: 79,
    minutes: 12,
    active: true,
    badge: "Best value",
    description: "Enough room for useful exports without a subscription.",
  },
  {
    id: "bulk",
    name: "Bulk",
    priceInr: 149,
    minutes: 24,
    active: false,
    description: "Hidden/manual pack for heavier creators after quality is proven.",
  },
] as const satisfies CreditPack[];

export const visibleLaunchCreditPacks = launchCreditPacks.filter((pack) => pack.active);

export const laterSubscriptionPlans = [
  {
    id: "light",
    name: "Light",
    priceInr: 99,
    monthlyMinutes: 16,
    description: "Entry subscription for students and local creators.",
  },
  {
    id: "creator",
    name: "Creator",
    priceInr: 249,
    monthlyMinutes: 45,
    description: "Main repeat plan once users trust the product.",
  },
  {
    id: "pro",
    name: "Pro",
    priceInr: 499,
    monthlyMinutes: 95,
    description: "Only after provider routing lowers real cost.",
  },
] as const satisfies SubscriptionPlan[];

export function estimateGatewayFeeInr(priceInr: number) {
  return Math.ceil(priceInr * RAZORPAY_DOMESTIC_FEE_RATE);
}

export function estimatePackEconomics(pack: CreditPack) {
  const variableCostInr = Math.ceil(pack.minutes * INTERNAL_COST_INR_PER_MINUTE);
  const gatewayFeeInr = estimateGatewayFeeInr(pack.priceInr);
  const grossProfitInr = pack.priceInr - variableCostInr - gatewayFeeInr;

  return {
    variableCostInr,
    gatewayFeeInr,
    grossProfitInr,
    pricePerMinuteInr: pack.priceInr / pack.minutes,
  };
}

export function getCreditPack(packId?: string | null) {
  return launchCreditPacks.find((pack) => pack.id === packId) || null;
}

export function estimateGenerationBilling(durationSeconds: number) {
  const billableMinutes = Math.max(1 / 60, durationSeconds / 60);
  const roundedCredits = Math.ceil(billableMinutes * 4) / 4;
  const internalCostInr = roundedCredits * INTERNAL_COST_INR_PER_MINUTE;

  return {
    estimatedMinutes: Number(billableMinutes.toFixed(2)),
    roundedCredits,
    internalCostInr: Number(internalCostInr.toFixed(2)),
    costFloorInrPerMinute: INTERNAL_COST_INR_PER_MINUTE,
  };
}
