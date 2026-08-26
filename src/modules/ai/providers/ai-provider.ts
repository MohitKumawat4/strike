import type { TriageResult } from "@/modules/ai/schemas/triage.schema";

export type SummarizationResult = {
  summaryText: string;
  extractedItems: Array<{ type: "task" | "deadline" | "entity"; value: string }>;
};

export interface AiProvider {
  triage(input: { subject: string; body: string }): Promise<TriageResult>;
  summarize(input: { subject: string; body: string }): Promise<SummarizationResult>;
}
