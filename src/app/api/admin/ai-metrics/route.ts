import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/database/supabase/server";

export async function GET(request: Request) {
  // Extract user authorization / PIN from headers if needed (mocked/simplified for now)
  const authHeader = request.headers.get("authorization");
  
  // Phase 4 will handle the formal PIN gate for the dashboard UI,
  // but we can add a basic check here.
  if (authHeader !== "Bearer 4002") {
    return NextResponse.json({ error: "Unauthorized access to AI metrics" }, { status: 401 });
  }

  const db = createSupabaseAdminClient();

  // Aggregate metrics from the ai_telemetry table
  const { data, error } = await db
    .from("ai_telemetry")
    .select("model, task, input_tokens, output_tokens, cost_usd, cost_inr");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const metrics = {
    totalInvokes: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    totalCostInr: 0,
    breakdown: {} as Record<string, { invokes: number; costUsd: number; costInr: number }>,
  };

  if (data) {
    for (const row of data) {
      metrics.totalInvokes++;
      metrics.totalInputTokens += row.input_tokens || 0;
      metrics.totalOutputTokens += row.output_tokens || 0;
      metrics.totalCostUsd += row.cost_usd || 0;
      metrics.totalCostInr += row.cost_inr || 0;

      const breakdownKey = `${row.model} (${row.task})`;
      if (!metrics.breakdown[breakdownKey]) {
        metrics.breakdown[breakdownKey] = { invokes: 0, costUsd: 0, costInr: 0 };
      }
      metrics.breakdown[breakdownKey].invokes++;
      metrics.breakdown[breakdownKey].costUsd += row.cost_usd || 0;
      metrics.breakdown[breakdownKey].costInr += row.cost_inr || 0;
    }
  }

  return NextResponse.json({ success: true, metrics });
}
