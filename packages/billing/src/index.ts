export type PlanId = "free" | "creator" | "studio";
export type ProductEntitlement = "chat" | "subtitles" | "voice";

export type EntitlementSnapshot = {
  planId: PlanId;
  products: ProductEntitlement[];
  monthlyCredits: number;
};

export const planEntitlements: Record<PlanId, EntitlementSnapshot> = {
  free: {
    planId: "free",
    products: ["chat"],
    monthlyCredits: 100
  },
  creator: {
    planId: "creator",
    products: ["chat", "subtitles"],
    monthlyCredits: 1500
  },
  studio: {
    planId: "studio",
    products: ["chat", "subtitles", "voice"],
    monthlyCredits: 8000
  }
};

export function canUseProduct(planId: PlanId, product: ProductEntitlement) {
  return planEntitlements[planId].products.includes(product);
}

