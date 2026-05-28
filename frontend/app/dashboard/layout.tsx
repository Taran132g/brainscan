"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Brain, Home, User, FileArchive, Settings, LogOut, Globe2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: Home, exact: true },
  { href: "/dashboard/matches", label: "Matches", icon: Users },
  { href: "/dashboard/discover", label: "Discover", icon: Globe2 },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/vault", label: "Vault & Uploads", icon: FileArchive },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Brain size={30} className="animate-pulse" style={{ color: "var(--accent)" }} />
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Loading your dashboard...</span>
      </div>
    );
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.email as string | undefined) ??
    "";

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen flex flex-col">
      {/* Top nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--border)" }}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>FindingFounders</span>
        </Link>
        <div className="flex items-center gap-4">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            {initials || "?"}
          </div>
          <span className="text-sm hidden sm:block" style={{ color: "var(--text-secondary)" }}>
            {displayName}
          </span>
          <button
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </nav>

      {/* Main layout */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className="w-56 flex-shrink-0 border-r py-6 hidden md:block"
          style={{ borderColor: "var(--border)" }}
        >
          <nav className="flex flex-col gap-1 px-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    backgroundColor: active ? "var(--accent-glow)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile horizontal nav */}
        <div
          className="md:hidden flex gap-1 px-3 py-2 border-b overflow-x-auto"
          style={{ borderColor: "var(--border)" }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap"
                style={{
                  backgroundColor: active ? "var(--accent-glow)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                <Icon size={13} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Main content */}
        <main className="flex-1 px-6 md:px-10 py-8 max-w-4xl">{children}</main>
      </div>
    </div>
  );
}
