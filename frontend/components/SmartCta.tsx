"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

type Props = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  // Where to route signed-in users (default /upload) and signed-out users (default /auth)
  signedInHref?: string;
  signedOutHref?: string;
};

/**
 * A CTA link that routes signed-in users to /upload and signed-out users to /auth.
 * Used by "Get Started" / "Upload Vault" buttons that gate on auth.
 */
export function SmartCta({
  children,
  className,
  style,
  signedInHref = "/dashboard",
  signedOutHref = "/auth",
}: Props) {
  const { user, loading } = useAuth();

  // Default to signed-out href until session loads — safer than flashing the wrong destination
  const href = !loading && user ? signedInHref : signedOutHref;

  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}
