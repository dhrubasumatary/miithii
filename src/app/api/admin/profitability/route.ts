import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminUserId } from "@/lib/admin";
import { isSupabaseConfigured, selectRows } from "@/lib/supabase/server";

type DailyProfitRow = {
  day: string;
  revenue_inr: number;
  generated_minutes: number;
  estimated_api_cost_inr: number;
  gross_profit_before_gateway_inr: number;
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!isAdminUserId(userId)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ rows: [], totals: null });
    }

    const rows = await selectRows<DailyProfitRow>(
      "daily_profitability",
      "select=*&order=day.desc&limit=60"
    );

    const totals = rows.reduce(
      (acc, row) => ({
        revenueInr: acc.revenueInr + Number(row.revenue_inr || 0),
        generatedMinutes: acc.generatedMinutes + Number(row.generated_minutes || 0),
        estimatedApiCostInr: acc.estimatedApiCostInr + Number(row.estimated_api_cost_inr || 0),
        grossProfitBeforeGatewayInr:
          acc.grossProfitBeforeGatewayInr + Number(row.gross_profit_before_gateway_inr || 0),
      }),
      {
        revenueInr: 0,
        generatedMinutes: 0,
        estimatedApiCostInr: 0,
        grossProfitBeforeGatewayInr: 0,
      }
    );

    return NextResponse.json({
      rows: rows.map((row) => ({
        day: row.day,
        revenueInr: Number(row.revenue_inr || 0),
        generatedMinutes: Number(row.generated_minutes || 0),
        estimatedApiCostInr: Number(row.estimated_api_cost_inr || 0),
        grossProfitBeforeGatewayInr: Number(row.gross_profit_before_gateway_inr || 0),
      })),
      totals,
    });
  } catch (error) {
    console.error("profitability error", error);
    return NextResponse.json({ error: "Could not load profitability" }, { status: 500 });
  }
}
