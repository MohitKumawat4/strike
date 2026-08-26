"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/database/supabase/browser";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
  nextPath?: string;
  initialError?: string;
};

function hasBrowserSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function AuthForm({ mode, nextPath, initialError }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [oneTimeCode, setOneTimeCode] = useState("");
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<string | null>(initialError ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLogin = mode === "login";
  const configured = hasBrowserSupabaseConfig();
  const destination = nextPath?.startsWith("/")
    ? nextPath
    : "/dashboard";

  async function handlePasswordSubmit() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus(error.message);
      setIsSubmitting(false);
      return;
    }

    router.replace(destination);
    router.refresh();
  }

  async function sendOneTimeCode() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (error) {
      setStatus(error.message);
      setIsSubmitting(false);
      return;
    }

    setOtpSent(true);
    setStatus(`A one-time code was sent to ${email}. Enter it below on this device.`);
    setIsSubmitting(false);
  }

  async function verifyOneTimeCode() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: oneTimeCode,
      type: "email",
    });

    if (error) {
      setStatus(error.message);
      setIsSubmitting(false);
      return;
    }

    router.replace(destination);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!configured) {
      setStatus(
        "Add your Supabase URL and publishable key to .env.local before signing in.",
      );
      return;
    }

    setIsSubmitting(true);

    if (isLogin) {
      if (loginMethod === "password") {
        await handlePasswordSubmit();
      } else if (otpSent) {
        await verifyOneTimeCode();
      } else {
        await sendOneTimeCode();
      }
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const confirmationUrl = new URL("/auth/confirm", window.location.origin);
    confirmationUrl.searchParams.set("next", destination);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: confirmationUrl.toString() },
    });

    if (error) {
      setStatus(error.message);
    } else if (data.session) {
      router.replace(destination);
      router.refresh();
      return;
    } else {
      setStatus("Check your inbox to confirm your email, then return to Strike.");
    }

    setIsSubmitting(false);
  }

  return (
    <section className="auth-card" aria-labelledby="auth-heading">
      <div className="auth-mark" aria-hidden="true">
        <Sparkles size={19} />
      </div>
      <p className="eyebrow">Strike intelligence</p>
      <h1 id="auth-heading">{isLogin ? "Welcome back" : "Create your workspace"}</h1>
      <p className="auth-description">
        {isLogin
          ? "Sign in to see the important things your inbox has been trying to tell you."
          : "Create your private command center for email intelligence."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>Email address</span>
          <div className="field-shell">
            <Mail size={17} aria-hidden="true" />
            <input
              autoComplete="email"
              disabled={isSubmitting}
              name="email"
              onChange={(event) => {
                setEmail(event.target.value);
                if (otpSent) {
                  setOtpSent(false);
                  setOneTimeCode("");
                }
              }}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </div>
        </label>

        {isLogin ? (
          <div className="auth-methods" role="group" aria-label="Sign in method">
            <button
              className={loginMethod === "password" ? "active" : ""}
              onClick={() => {
                setLoginMethod("password");
                setStatus(null);
              }}
              type="button"
            >Password</button>
            <button
              className={loginMethod === "otp" ? "active" : ""}
              onClick={() => {
                setLoginMethod("otp");
                setStatus(null);
              }}
              type="button"
            >Email code</button>
          </div>
        ) : null}

        {!isLogin || loginMethod === "password" ? (
          <label>
            <span>Password</span>
            <div className="field-shell">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                autoComplete={isLogin ? "current-password" : "new-password"}
                disabled={isSubmitting}
                minLength={6}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="field-action"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
        ) : otpSent ? (
          <label>
            <span>One-time code</span>
            <div className="field-shell otp-shell">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                autoComplete="one-time-code"
                disabled={isSubmitting}
                inputMode="numeric"
                maxLength={8}
                minLength={6}
                name="one-time-code"
                onChange={(event) => setOneTimeCode(event.target.value.replace(/\D/g, ""))}
                pattern="[0-9]{6,8}"
                placeholder="Enter code"
                required
                value={oneTimeCode}
              />
            </div>
            <button
              className="resend-code"
              disabled={isSubmitting}
              onClick={() => {
                setOtpSent(false);
                setOneTimeCode("");
                setStatus(null);
              }}
              type="button"
            >
              <ArrowLeft size={14} /> Use a different email
            </button>
          </label>
        ) : (
          <p className="code-explainer">We’ll send a short-lived code to your email. Read it on any device and enter it here.</p>
        )}

        {status ? <p className="auth-status" role="status">{status}</p> : null}

        <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
          <span>{isSubmitting
            ? "Working…"
            : !isLogin
              ? "Create account"
              : loginMethod === "password"
                ? "Sign in"
                : otpSent
                  ? "Verify code"
                  : "Send email code"}</span>
          {isLogin && loginMethod === "otp" && !otpSent ? <RefreshCw size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
        </button>
      </form>

      <p className="auth-switch">
        {isLogin ? "New to Strike?" : "Already have an account?"}{" "}
        <Link href={isLogin ? "/signup" : "/login"}>
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </section>
  );
}
