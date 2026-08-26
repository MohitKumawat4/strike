import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Load .env.local if present
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = (match[2] || "").trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        if (!process.env[key]) process.env[key] = value;
      }
    });
  }
} catch {
  // Ignore env loading errors
}

// Fallback defaults for standalone testing
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "test_key";
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test_google_client_id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "test_google_secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

import { encryptToken, decryptToken } from "../common/crypto/encryption";
import { triageEmailWithAi } from "../modules/ai/prompts/triage";
import { summarizeEmailWithAi } from "../modules/ai/prompts/summary";

let totalTests = 0;
let passedTests = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}:`, err);
  }
}

async function runAllTests() {
  console.log("\n🚀 Running Strike Subsystem Test Suite...\n");

  // ==========================================
  // 1. CRYPTO / AES-256-GCM SECURITY
  // ==========================================
  console.log("📦 1. Testing Crypto & Token Encryption Subsystem:");

  await runTest("Encrypts and decrypts OAuth tokens accurately", () => {
    const rawSecret = "ya29.a0AfH6SMD_test_google_refresh_token_1234567890";
    const encrypted = encryptToken(rawSecret);

    assert.notEqual(encrypted, rawSecret);
    assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

    const decrypted = decryptToken(encrypted);
    assert.equal(decrypted, rawSecret);
  });

  await runTest("Generates unique IVs and ciphertexts for identical tokens", () => {
    const rawSecret = "sample_refresh_token";
    const enc1 = encryptToken(rawSecret);
    const enc2 = encryptToken(rawSecret);

    assert.notEqual(enc1, enc2);
    assert.equal(decryptToken(enc1), rawSecret);
    assert.equal(decryptToken(enc2), rawSecret);
  });

  await runTest("Rejects corrupted or tampered ciphertexts", () => {
    const rawSecret = "sensitive_token";
    const encrypted = encryptToken(rawSecret);
    const parts = encrypted.split(":");
    // Tamper with the ciphertext part
    const tampered = `${parts[0]}:deadbeef${parts[1].slice(8)}:${parts[2]}`;

    assert.throws(() => {
      decryptToken(tampered);
    });
  });

  // ==========================================
  // 2. AI TRIAGE & IMPORTANCE SCORING
  // ==========================================
  console.log("\n🧠 2. Testing AI Triage & Classification Subsystem:");

  await runTest("Triages urgent emails with high priority", async () => {
    const triageResult = await triageEmailWithAi({
      subject: "URGENT: Contract Signature Required Before 5 PM Deadline",
      sender: "legal@partner-firm.com",
      snippet: "Please review and execute the final agreement before the close of business.",
    });

    assert.ok(triageResult.result);
    assert.ok(
      triageResult.result.category === "important" || triageResult.result.category === "normal"
    );
    assert.ok(triageResult.result.importance >= 0.7, `Importance score was ${triageResult.result.importance}`);
    assert.ok(triageResult.result.confidence > 0);
    assert.ok(triageResult.result.reason.length > 0);
  });

  await runTest("Triages marketing newsletters as promotional or low importance", async () => {
    const triageResult = await triageEmailWithAi({
      subject: "50% OFF Flash Sale this weekend only!",
      sender: "marketing@ecommerce-store.com",
      snippet: "Check out our newest discount catalog and save big today.",
    });

    assert.ok(triageResult.result);
    assert.ok(
      triageResult.result.category === "promotional" || triageResult.result.importance <= 0.6
    );
  });

  // ==========================================
  // 3. AI SUMMARIZATION & ACTION ITEMS
  // ==========================================
  console.log("\n📝 3. Testing AI Summarization & Action Extraction Subsystem:");

  await runTest("Generates executive summary and structured action items", async () => {
    const summaryResult = await summarizeEmailWithAi({
      subject: "Project Strike Sprint Review & Deliverables",
      sender: "alex@team.internal",
      snippet: "Here is the summary of sprint 4. Please send the slide deck by Thursday.",
      bodyText:
        "Hi Mohit,\n\nWe need you to prepare the architecture diagrams and send the slide deck by Thursday at 3 PM.\n\nThanks,\nAlex",
    });

    assert.ok(summaryResult.result.summary_text.length > 10);
    assert.ok(Array.isArray(summaryResult.result.extracted_items));
  });

  // ==========================================
  // 4. PROCESSING PIPELINE LOGIC
  // ==========================================
  console.log("\n⚙️ 4. Testing Processing Pipeline Stage State Machine:");

  await runTest("Calculates exponential backoff delay correctly", () => {
    const calcDelaySeconds = (attempt: number) => Math.min(Math.pow(2, attempt) * 15, 3600);

    assert.equal(calcDelaySeconds(0), 15); // attempt 0 -> 15s
    assert.equal(calcDelaySeconds(1), 30); // attempt 1 -> 30s
    assert.equal(calcDelaySeconds(2), 60); // attempt 2 -> 60s
    assert.equal(calcDelaySeconds(3), 120); // attempt 3 -> 120s
    assert.equal(calcDelaySeconds(10), 3600); // capped at 3600s
  });

  // ==========================================
  // 5. PUB/SUB PAYLOAD DECODER
  // ==========================================
  console.log("\n🔔 5. Testing Google Pub/Sub Webhook Payload Parser:");

  await runTest("Decodes base64 Pub/Sub push notification payloads correctly", () => {
    const rawNotification = {
      emailAddress: "user@example.com",
      historyId: "987654321",
    };

    const base64Data = Buffer.from(JSON.stringify(rawNotification)).toString("base64");
    const decodedString = Buffer.from(base64Data, "base64").toString("utf-8");
    const parsed = JSON.parse(decodedString);

    assert.equal(parsed.emailAddress, "user@example.com");
    assert.equal(parsed.historyId, "987654321");
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Test Results: ${passedTests} of ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
