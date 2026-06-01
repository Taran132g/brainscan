"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Reveal } from "@/components/Reveal";

/**
 * The video wall on the landing page.
 *
 * 👉 To swap these, just edit the VIDEOS array below — paste any YouTube URL
 * (watch, youtu.be, or embed form) or a bare 11-character video ID into `url`.
 * The thumbnail + lazy embed are derived automatically; nothing else to touch.
 */
const VIDEOS: { url: string; title: string; tag: string }[] = [
  {
    url: "https://www.youtube.com/watch?v=WqKluXIra70",
    title: "Obsidian as a second brain — the full walkthrough",
    tag: "Building a second brain",
  },
  {
    url: "https://www.youtube.com/watch?v=JtBOl-eFHZc",
    title: "Your second brain in Obsidian, step by step",
    tag: "Getting started",
  },
  {
    url: "https://www.youtube.com/watch?v=pftNwHmNXzs",
    title: "Organize, plan, and execute ideas with Obsidian",
    tag: "Why it works",
  },
];

/** Pull the 11-char YouTube id out of any URL form, or accept a bare id. */
function youtubeId(input: string): string {
  const m = input.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : input;
}

function VideoCard({ url, title, tag }: { url: string; title: string; tag: string }) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(url);

  return (
    <div
      className="rounded-2xl border overflow-hidden card-hover flex flex-col"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play: ${title}`}
            className="group absolute inset-0 h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.45))" }}
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
      <div className="p-4">
        <div className="text-xs font-medium mb-1.5" style={{ color: "var(--accent)" }}>
          {tag}
        </div>
        <h3 className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
      </div>
    </div>
  );
}

export function VideoWall() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {VIDEOS.map((v, i) => (
        <Reveal key={v.url} delay={i * 90} className="h-full">
          <VideoCard {...v} />
        </Reveal>
      ))}
    </div>
  );
}
