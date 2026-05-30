"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Message = {
  id: string;
  match_id: string;
  sender: string;
  body: string;
  created_at: string;
};

/**
 * In-app chat for a connected match. Reads/writes the `messages` table directly
 * through the anon client — RLS (migration 0006) gates access to participants
 * of a both-accepted match, so messaging is only possible once connected.
 *
 * New messages arrive over Supabase Realtime (postgres_changes on INSERT). A
 * lightweight poll runs as a safety net in case the Realtime publication isn't
 * wired in a given environment.
 */
export function ChatThread({
  matchId,
  currentUserId,
  otherName,
}: {
  matchId: string;
  currentUserId: string;
  otherName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const mergeMessages = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      let changed = false;
      for (const m of incoming) {
        if (!byId.has(m.id)) changed = true;
        byId.set(m.id, m);
      }
      // Referential stability: if the poll brought nothing new, keep the same
      // array so we don't re-render and auto-scroll the user back to the bottom.
      if (!changed) return prev;
      return Array.from(byId.values()).sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      );
    });
  }, []);

  const loadMessages = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });
    if (err) {
      setError(err.message);
    } else if (data) {
      mergeMessages(data as Message[]);
    }
    setLoading(false);
  }, [matchId, mergeMessages]);

  // Initial load + realtime subscription + poll fallback
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    loadMessages();

    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => mergeMessages([payload.new as Message])
      )
      .subscribe();

    const poll = setInterval(loadMessages, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [matchId, loadMessages, mergeMessages]);

  // Auto-scroll to newest
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    const { data, error: err } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender: currentUserId, body })
      .select()
      .single();
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data) mergeMessages([data as Message]);
    setDraft("");
  };

  return (
    <div className="flex flex-col h-[60vh]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-1">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              You&apos;re connected with {otherName}. Say hello and pitch what you&apos;d build together.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender === currentUserId;
            return (
              <div
                key={m.id}
                className="max-w-[75%] px-3 py-2 rounded-2xl text-sm"
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  backgroundColor: mine ? "var(--accent)" : "var(--surface)",
                  color: mine ? "white" : "var(--text-primary)",
                  border: mine ? "none" : "1px solid var(--border)",
                  borderBottomRightRadius: mine ? 4 : 16,
                  borderBottomLeftRadius: mine ? 16 : 4,
                }}
              >
                {m.body}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="text-xs px-3 py-2" style={{ color: "#f87171" }}>{error}</p>
      )}

      {/* Composer */}
      <div className="flex items-center gap-2 pt-3 border-t mt-2" style={{ borderColor: "var(--border)" }}>
        <input
          value={draft}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Message ${otherName}…`}
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none border"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="flex items-center justify-center w-10 h-10 rounded-lg disabled:opacity-40"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  );
}
