"use client";

import { FormEvent, useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || "Could not join the waitlist");
      setState("success");
      setMessage("You’re on the list. We’ll let you know when it’s ready.");
      setEmail("");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not join the waitlist");
    }
  }

  return (
    <form className="subtitles-form" onSubmit={submit} aria-label="Join the subtitles waitlist">
      <label className="sr-only" htmlFor="waitlist-email">Email address</label>
      <div className="subtitles-form__row">
        <input
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={state === "submitting"}
          required
        />
        <button type="submit" disabled={state === "submitting"}>
          {state === "submitting" ? "Joining…" : state === "success" ? "Joined" : "Join waitlist"}
        </button>
      </div>
      {message ? (
        <p className={`subtitles-form__status subtitles-form__status--${state}`} role={state === "error" ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
