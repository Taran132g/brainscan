/* eslint-disable @next/next/no-img-element */

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Profile avatar — shows the uploaded photo when present, otherwise a colored
 * circle with the person's initials. Used everywhere an avatar appears.
 */
export function Avatar({
  url,
  name,
  size = 40,
  color = "var(--accent)",
  textColor = "#04110b",
  className = "",
}: {
  url?: string | null;
  name: string;
  size?: number;
  color?: string;
  textColor?: string;
  className?: string;
}) {
  const dim = { width: size, height: size, minWidth: size };

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`rounded-full object-cover ${className}`}
        style={dim}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 ${className}`}
      style={{ ...dim, backgroundColor: color, color: textColor, fontSize: Math.round(size * 0.4) }}
    >
      {initialsOf(name) || "?"}
    </div>
  );
}
