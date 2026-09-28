import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf-8").split("\n").reduce((acc, line) => {
  const [k, ...v] = line.split("=");
  if (k) acc[k] = v.join("=").replace(/"/g, "").trim();
  return acc;
}, {} as any);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { error } = await db.from("email_messages").select("id,ai_results(message_id),summaries(summary_text)").limit(1);
  console.log("BAD RELATION ERROR:", error);
}
test();
