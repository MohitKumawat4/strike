import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8").split("\n").reduce((acc, line) => {
  const [k, ...v] = line.split("=");
  if (k) acc[k] = v.join("=").replace(/"/g, "").trim();
  return acc;
}, {} as any);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await db.from("email_messages").select("id,summaries(summary_text)").limit(1);
  console.log("ERROR:", error);
  console.log("DATA:", JSON.stringify(data, null, 2));
}
test();
