"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Supabase detectSessionInUrl handles the URL exchange automatically.
    // We just wait for the session to populate, then route.
    if (!loading) {
      if (user) {
        router.replace("/upload");
      } else {
        router.replace("/auth");
      }
    }
  }, [loading, user, router]);

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
