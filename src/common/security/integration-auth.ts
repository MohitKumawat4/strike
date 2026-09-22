import { OAuth2Client } from "google-auth-library";
export function isCronAuthorized(request: Request): boolean {
    const secret = process.env.CRON_SECRET;
    return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}
export async function verifyPubSubRequest(request: Request): Promise<boolean> {
    const audience = process.env.GOOGLE_PUBSUB_AUDIENCE;
    const email = process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL;
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!audience || !email || !token)
        return false;
    try {
        const ticket = await new OAuth2Client().verifyIdToken({ idToken: token, audience });
        const payload = ticket.getPayload();
        return Boolean(payload && payload.email_verified && payload.email === email &&
            ["accounts.google.com", "https://accounts.google.com"].includes(payload.iss));
    }
    catch {
        return false;
    }
}
