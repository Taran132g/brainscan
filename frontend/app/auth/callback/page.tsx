"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function processCallback() {
      // Supabase v2 with detectSessionInUrl handles both implicit (#) and PKCE (?code=)
      // flows automatically. We just need to wait for the session to populate.

      // If Google returned an error (e.g. user cancelled), surface it
      const url = new URL(window.location.href);
      const errParam = url.searchParams.get("error") ?? url.hash.match(/error=([^&]+)/)?.[1];
      const errDesc = url.searchParams.get("error_description") ?? url.hash.match(/error_description=([^&]+)/)?.[1];
      if (errParam) {
        setError(decodeURIComponent(errDesc || errParam));
        return;
      }

      // For PKCE (?code=...), explicitly exchange the code for a session.
      // detectSessionInUrl should do this automatically but we'll force it here
      // to eliminate the race condition with the layout's AuthProvider.
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(`Could not complete sign-in: ${exchangeError.message}`);
          return;
        }
      }

      // Now poll for a session — give Supabase up to 5 seconds to settle
      for (let i = 0; i < 25; i++) {
        if (cancelled) return;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          // New users go through onboarding first; it self-redirects returning
          // users (already onboarded) straight to the dashboard.
          const onboarded = data.session.user?.user_metadata?.onboarded;
          router.replace(onboarded ? "/dashboard" : "/onboarding");
          return;
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      // Still no session after 5 seconds — surface the actual URL so we can debug
      setDebug(`URL: ${window.location.href}`);
      setError("Sign-in didn't complete. Supabase didn't return a session.");
    }

    processCallback();
    return () => { cancelled = true; };
  }, [router]);

  if (error) {
    return (
      <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
        <AlertCircle size={36} style={{ color: "#f87171" }} />
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Sign-in failed
          </h1>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{error}</p>
          {debug && (
            <pre className="text-[10px] text-left p-3 rounded-lg overflow-x-auto mb-4"
              style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)" }}>
              {debug}
            </pre>
          )}
          <a href="/auth" className="text-sm font-medium hover:underline" style={{ color: "var(--accent)" }}>
            ← Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Brain size={36} className="animate-pulse" style={{ color: "var(--accent)" }} />
      <div className="flex items-center gap-2">
        <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Signing you in...
        </span>
      </div>
    </div>
  );
}
