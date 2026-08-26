# Email-code sign-in setup

Strike now supports two login methods:

- Email and password
- A one-time email code that can be read on a phone and entered on a laptop

The application code is ready. Configure the hosted Supabase email template once so its passwordless login email includes a code instead of a clickable link.

## Supabase Dashboard configuration

1. Open **Authentication → Emails** in the Strike Supabase project.
2. Open the **Magic Link** template.
3. Set the subject to:

   ```text
   Your Strike sign-in code
   ```

4. Replace the body with:

   ```html
   <h2>Your Strike sign-in code</h2>
   <p>Enter this code in Strike to sign in:</p>
   <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.15em;">{{ .Token }}</p>
   <p>This code expires shortly and can only be used once. If you did not request it, you can safely ignore this email.</p>
   ```

5. Save the template.

Do not change the **Confirm signup** template. It still verifies a new account by email link. After the account is confirmed once, use the **Email code** option on `/login` to sign in from any device.

Supabase rate-limits OTP requests to one per 60 seconds by default. Codes expire after the duration configured in **Authentication → Sign In / Providers → Email**.
