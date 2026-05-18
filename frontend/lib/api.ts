import { supabase } from "./supabase";

// Centralized API base URL. Override via NEXT_PUBLIC_API_BASE_URL in .env.local.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/**
 * Authenticated fetch — pulls the current Supabase session and adds an
 * `Authorization: Bearer <access_token>` header automatically.
 *
 * Throws if the user is not signed in. Caller should redirect to /auth in
 * that case.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Not signed in.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
