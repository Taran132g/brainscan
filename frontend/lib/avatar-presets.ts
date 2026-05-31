import {
  Rocket, Sparkles, Zap, Flame, Brain, Compass, Gem, Mountain,
  type LucideIcon,
} from "lucide-react";

/**
 * Preset avatars — gradient + icon "characters" a user can pick instead of
 * uploading a photo. The chosen preset id is stored in `avatar_url` exactly
 * like a real URL; the Avatar component detects the `preset:` prefix and renders
 * it locally, so presets work everywhere avatars show (no hosting needed).
 */
export type AvatarPreset = { id: string; gradient: string; Icon: LucideIcon };

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "preset:rocket", gradient: "linear-gradient(135deg,#10b981,#059669)", Icon: Rocket },
  { id: "preset:spark", gradient: "linear-gradient(135deg,#6366f1,#a855f7)", Icon: Sparkles },
  { id: "preset:bolt", gradient: "linear-gradient(135deg,#f59e0b,#ef4444)", Icon: Zap },
  { id: "preset:flame", gradient: "linear-gradient(135deg,#ec4899,#ef4444)", Icon: Flame },
  { id: "preset:brain", gradient: "linear-gradient(135deg,#06b6d4,#3b82f6)", Icon: Brain },
  { id: "preset:compass", gradient: "linear-gradient(135deg,#14b8a6,#0ea5e9)", Icon: Compass },
  { id: "preset:gem", gradient: "linear-gradient(135deg,#a855f7,#ec4899)", Icon: Gem },
  { id: "preset:peak", gradient: "linear-gradient(135deg,#84cc16,#10b981)", Icon: Mountain },
];

export const PRESET_MAP: Record<string, AvatarPreset> = Object.fromEntries(
  AVATAR_PRESETS.map((p) => [p.id, p])
);

export function isPreset(url?: string | null): boolean {
  return !!url && url.startsWith("preset:");
}
