import type { Metadata } from "next";
import { API_BASE_URL } from "@/lib/api";

type Params = Promise<{ userId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { userId } = await params;
  let name = "Founder";
  try {
    const r = await fetch(`${API_BASE_URL}/api/og/profile/${userId}`, { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      name = data.full_name || "Founder";
    }
  } catch {
    // Fall through to generic copy — OG image route handles missing data on its own.
  }

  const title = `${name} — FindingFounders Brain Card`;
  const description = `${name}'s co-founder brain card on FindingFounders. Built from their own writing.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
