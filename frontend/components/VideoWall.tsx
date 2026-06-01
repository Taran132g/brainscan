"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Reveal } from "@/components/Reveal";

/**
 * Vertical short-form video wall on the landing page — rendered like the PAIS
 * content-workflow dashboard (9:16 cards, lazy click-to-play).
 *
 * 👉 To swap these, just edit the VIDEOS array — paste any YouTube URL
 * (shorts/watch/youtu.be/embed) or a bare 11-char id into `url`. The thumbnail
 * + embed are derived automatically. `caption` is the small label below it.
 */
const VIDEOS: { url: string; caption: string }[] = [
  { url: "https://www.youtube.com/shorts/yJK5GueSHmU", caption: "BrainScan in a minute" },
  { url: "https://www.youtube.com/shorts/x6Nfbd5Pa4A", caption: "Your notes, read back to you" },
  { url: "https://www.youtube.com/shorts/pZqGHxtm6FM", caption: "Meet people on the real signal" },
];

/** Pull the 11-char YouTube id out of any URL form (incl. /shorts/), or accept a bare id. */
function youtubeId(input: string): string {
  const m = input.match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? m[1] : input;
}

function ShortCard({ url, caption }: { url: string; caption: string }) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(url);

  return (
    <div
      className="w-full max-w-[270px] overflow-hidden rounded-2xl border card-hover"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* 9:16 vertical player, matching the PAIS render cards */}
      <div className="relative aspect-[9/16] bg-black">
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
            title={caption}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play: ${caption}`}
            className="group absolute inset-0 h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${id}/hq720.jpg`}
              alt={caption}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.40))" }}
            />
            <span
              className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 glow-accent"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              <Play size={22} className="ml-0.5" fill="white" />
            </span>
          </button>
        )}
      </div>
      <div className="px-3.5 py-3 text-center">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {caption}
        </span>
      </div>
    </div>
  );
}

export function VideoWall() {
  return (
    <div className="flex flex-wrap justify-center gap-5">
      {VIDEOS.map((v, i) => (
        <Reveal key={v.url} delay={i * 90}>
          <ShortCard {...v} />
        </Reveal>
      ))}
    </div>
  );
}
