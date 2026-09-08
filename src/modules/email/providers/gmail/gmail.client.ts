import { google } from "googleapis";
import { getServerEnv } from "@/config/server-env";
import { decryptToken } from "@/common/crypto/encryption";
import { GMAIL_READONLY_SCOPE, GMAIL_MODIFY_SCOPE } from "./gmail.constants";

/**
 * Creates a configured Google OAuth2 client.
 */
export function getGoogleOAuthClient() {
  const env = getServerEnv();

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

/**
 * Generates the Google OAuth authorization URL requesting offline access
 * and read/modify Gmail scopes.
 * Uses prompt="consent select_account" to ensure multi-account switching works cleanly.
 */
export function getGoogleAuthUrl(state: string): string {
  const oauth2Client = getGoogleOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent select_account",
    scope: [
      GMAIL_READONLY_SCOPE,
      GMAIL_MODIFY_SCOPE,
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "openid",
    ],
    state,
  });
}

/**
 * Exchanges an authorization code for access and refresh tokens,
 * and fetches the Gmail user profile details.
 */
export async function exchangeCodeAndFetchProfile(code: string) {
  const oauth2Client = getGoogleOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error("No refresh token received from Google. Ensure you approved permissions.");
  }

  oauth2Client.setCredentials(tokens);

  // Check if gmail scope was granted in the returned tokens
  const grantedScopeStr = tokens.scope || "";
  const hasGmailScope =
    grantedScopeStr.includes("gmail.readonly") ||
    grantedScopeStr.includes("gmail.modify") ||
    grantedScopeStr.includes("mail.google.com");

  if (!hasGmailScope) {
    throw new Error(
      "Gmail read permission was not granted. When Google asks for permissions, please check the box allowing Strike to view your email messages."
    );
  }

  let emailAddress: string | undefined;
  let historyId: string | null = null;

  try {
    // 1. Fetch the connected Gmail mailbox profile
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profileResponse = await gmail.users.getProfile({ userId: "me" });
    emailAddress = profileResponse.data.emailAddress ?? undefined;
    historyId = profileResponse.data.historyId ?? null;
  } catch (profileErr) {
    console.warn("Could not fetch via gmail.users.getProfile, trying oauth2 userinfo fallback:", profileErr);
  }

  // 2. Fallback to oauth2 userinfo if getProfile did not return email
  if (!emailAddress) {
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userinfo = await oauth2.userinfo.get();
      emailAddress = userinfo.data.email ?? undefined;
    } catch (userinfoErr) {
      console.error("Could not fetch userinfo:", userinfoErr);
    }
  }

  if (!emailAddress) {
    throw new Error("Could not retrieve email address from Google profile. Please try connecting again.");
  }

  return {
    tokens,
    emailAddress,
    historyId,
  };
}

/**
 * Modifies an email message labels directly in Gmail (e.g. Mark Read, Archive, Star).
 * Uses decrypted refresh token to establish an authorized Gmail API session.
 */
export async function modifyGmailMessage(
  encryptedRefreshToken: string,
  providerMessageId: string,
  options: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
  }
) {
  const refreshToken = decryptToken(encryptedRefreshToken);
  const oauth2Client = getGoogleOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const res = await gmail.users.messages.modify({
    userId: "me",
    id: providerMessageId,
    requestBody: {
      addLabelIds: options.addLabelIds || [],
      removeLabelIds: options.removeLabelIds || [],
    },
  });

  return res.data;
}
