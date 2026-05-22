"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, Mail, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function AuthPage() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, sendEmailOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // If user is already signed in, send them straight to upload
  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setError("");
    const { error: err } = await sendEmailOtp(email);
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    // Pass the email to the verify page via query string
    router.push(`/auth/verify?email=${encodeURIComponent(email)}`);
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithGoogle();
      // OAuth handles redirect via /auth/callback
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
    }
  };

  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>FindingFounders</span>
        </div>
        <Link href="/" className="flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={14} /> Home
        </Link>
      </nav>

      <div className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Sign in
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Welcome back, or create your account. We&apos;ll send a 6-digit code to your email to verify.
        </p>

        {/* Google sign in */}
        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-lg font-medium text-sm transition-opacity hover:opacity-90 mb-4 border"
          style={{
            backgroundColor: "var(--surface)",
            color: "var(--text-primary)",
            borderColor: "var(--border)",
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>or</span>
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
        </div>

        {/* Email OTP */}
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Email address
          </label>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <Mail size={16} style={{ color: "var(--text-secondary)" }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          <button
            type="submit"
            disabled={sending || !email}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-opacity hover:opacity-90 disabled:opacity-40 mt-2"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : null}
            {sending ? "Sending code..." : "Send verification code"}
            {!sending && <ArrowRight size={14} />}
          </button>
        </form>

        {error && (
          <p className="text-sm mt-4 px-4 py-3 rounded-lg"
            style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
            {error}
          </p>
        )}

        <p className="text-xs text-center mt-8" style={{ color: "var(--text-secondary)" }}>
          By signing in, you agree to let us process your Obsidian vault into embeddings.
          Your raw notes are never stored or shared.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
