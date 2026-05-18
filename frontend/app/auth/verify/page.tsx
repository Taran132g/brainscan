"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brain, ArrowLeft, Mail, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

function VerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const { verifyEmailOtp, sendEmailOtp, user, loading } = useAuth();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);

  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/upload");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!email) router.replace("/auth");
  }, [email, router]);

  const handleDigit = (index: number, value: string) => {
    // Only digits, single character
    const digit = value.replace(/\D/, "").slice(0, 1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.split("").concat(Array(6).fill("")).slice(0, 6);
    setCode(next);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeStr = code.join("");
    if (codeStr.length !== 6) return;
    setVerifying(true);
    setError("");
    const { error: err } = await verifyEmailOtp(email, codeStr);
    setVerifying(false);
    if (err) {
      setError(err);
      return;
    }
    setVerified(true);
    setTimeout(() => router.push("/upload"), 600);
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    const { error: err } = await sendEmailOtp(email);
    setResending(false);
    if (err) {
      setError(err);
      return;
    }
    setResentAt(Date.now());
  };

  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen">
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>FindingFounders</span>
        </div>
        <Link href="/auth" className="flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={14} /> Back
        </Link>
      </nav>

      <div className="max-w-md mx-auto px-6 py-16">
        {verified ? (
          <div className="flex flex-col items-center text-center gap-4">
            <CheckCircle size={48} style={{ color: "#34d399" }} />
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Email verified</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Redirecting to upload...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-6">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--accent-glow)", border: "1px solid var(--accent)" }}
              >
                <Mail size={22} style={{ color: "var(--accent)" }} />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center mb-2" style={{ color: "var(--text-primary)" }}>
              Check your email
            </h1>
            <p className="text-sm text-center mb-8" style={{ color: "var(--text-secondary)" }}>
              We sent a 6-digit code to <strong style={{ color: "var(--text-primary)" }}>{email}</strong>.
              Enter it below to verify.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex justify-center gap-2">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    className="w-12 h-14 rounded-lg text-center text-lg font-semibold outline-none border-2 transition-colors"
                    style={{
                      backgroundColor: "var(--surface)",
                      borderColor: digit ? "var(--accent)" : "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={code.join("").length !== 6 || verifying}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                {verifying ? <Loader2 size={14} className="animate-spin" /> : null}
                {verifying ? "Verifying..." : "Verify and continue"}
              </button>
            </form>

            {error && (
              <p className="text-sm mt-4 px-4 py-3 rounded-lg"
                style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
                {error}
              </p>
            )}

            <div className="flex items-center justify-center gap-2 mt-6">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Didn&apos;t get the code?
              </span>
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-xs font-medium hover:underline disabled:opacity-50"
                style={{ color: "var(--accent)" }}
              >
                {resending ? "Sending..." : resentAt ? "Resent ✓" : "Resend"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div />}>
      <VerifyContent />
    </Suspense>
  );
}
