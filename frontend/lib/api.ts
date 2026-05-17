// Centralized API base URL.
// Set NEXT_PUBLIC_API_BASE_URL in frontend/.env.local to override.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
