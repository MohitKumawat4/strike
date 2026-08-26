import { z } from "zod";

export const triageResultSchema = z.object({
  category: z.enum(["important", "normal", "spam", "promotional"]),
  importance: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(280),
});

export type TriageResult = z.infer<typeof triageResultSchema>;
