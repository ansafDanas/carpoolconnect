/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";

/** How close to the bottom (in px) still counts as "following along". */
const STICK_TO_BOTTOM_PX = 64;

/**
 * Deliberately minimal: plain text, only between the two people on a
 * confirmed trip. This is the missing coordination channel.
 */
function TripChat({ bookingId, token, otherPerson, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // The scroll container is the chat list itself. We never call
  // scrollIntoView here: that scrolls *every* scrollable ancestor, including
  // the document, which used to yank the whole page down on each poll.
  const listRef = useRef(null);
  const followRef = useRef(true);

  /** Cheap identity for the list: ids in order. Unchanged means unchanged. */
  const signature = (list) => list.map((m) => m._id).join(",");

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!bookingId || !token) return;

      try {
        const response = await api.get(`/social/chat/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const incoming = Array.isArray(response.data.data) ? response.data.data : [];

        // Only touch state when the conversation genuinely changed, so a poll
        // tick cannot cause a re-render (and therefore a layout shift).
        setMessages((current) =>
          signature(current) === signature(incoming) ? current : incoming
        );
        setError("");
      } catch (requestError) {
        if (silent) return;
        setError(
          requestError.response?.data?.message || "Could not load the conversation."
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [bookingId, token]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!bookingId || !token) return undefined;

    const timer = setInterval(() => {
      void load({ silent: true });
    }, 10000);

    return () => clearInterval(timer);
  }, [bookingId, token, load]);

  // Scroll the chat list -- and only the chat list -- and only when the user is
  // already reading the bottom of the conversation.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !followRef.current) return;

    list.scrollTop = list.scrollHeight;
  }, [messages]);

  /** Track intent so sending a message keeps the view pinned to the bottom. */
  const handleListScroll = () => {
    const list = listRef.current;
    if (!list) return;

    followRef.current =
      list.scrollHeight - list.scrollTop - list.clientHeight < STICK_TO_BOTTOM_PX;
  };

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setDraft("");
    // The user acted, so keep the newest message in view.
    followRef.current = true;

    try {
      const response = await api.post(
        `/social/chat/${bookingId}`,
        { body },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((current) => [...current, response.data.data]);
    } catch (sendError) {
      setDraft(body);
      setError(sendError.response?.data?.message || "Message did not send.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-text-muted">Opening your conversation...</p>;
  }

  return (
    <div className="rounded-[28px] border border-border bg-surface p-5 shadow-soft">
      <header className="mb-4">
        <h3 className="font-display text-xl font-bold text-primary">
          Chat with {otherPerson?.name || "your travel buddy"}
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          Agree on a pickup spot here. Be kind, be on time.
        </p>
      </header>

      {error && (
        <p className="mb-3 rounded-2xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <div
        className="max-h-72 space-y-2.5 overflow-y-auto overscroll-contain rounded-2xl bg-surface-muted p-3"
        onScroll={handleListScroll}
        ref={listRef}
      >
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-text-muted">
            Say hello. Most people text something like{" "}
            &ldquo;I&rsquo;m near the metro, blue shirt&rdquo;.
          </p>
        )}

        {messages.map((message) => {
          const mine = message.sender === currentUserId;
          return (
            <p
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                mine
                  ? "ml-auto bg-leaf text-white"
                  : "bg-surface text-primary shadow-soft"
              }`}
              key={message._id}
            >
              {message.body}
            </p>
          );
        })}
      </div>

      <form className="mt-3 flex gap-2" onSubmit={send}>
        <input
          aria-label="Write a message"
          className="flex-1 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-leaf"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a message..."
          value={draft}
        />
        <button
          className="rounded-2xl bg-leaf px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-leaf-hover disabled:opacity-60"
          disabled={!draft.trim() || sending}
          type="submit"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default TripChat;