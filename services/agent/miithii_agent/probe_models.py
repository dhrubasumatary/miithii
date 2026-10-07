"""Compare candidate models on the two things that actually matter here.

First-token latency and language quality, measured through the same gateway and the same compiled
language-pack prompt the agent uses. Choosing a model on a provider's marketing page produced
a 5.7-9 second first token and a model that "keeps thinking" about a one-line reply, so the
choice gets measured instead.

Quality here means only what a script gate and a length check can see. It is not fluency, and
it is not a substitute for a native speaker's judgement.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time

import aiohttp

from .policy import get_policy
from .probe import load_env

CANDIDATES = (
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-pro",
    "google/gemini-3.8-flash",
)

PROMPTS = {
    "asm": "আপুনি কেমন আছে?",
    "brx": "आं बेयावनो दं, मा बुंनो नागिरदों। थिखि ना?",
}


async def measure(session, model: str, policy, question: str) -> dict:
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": policy.system_prompt},
            {"role": "user", "content": question},
        ],
        "max_tokens": policy.generation_max_tokens,
        "stream": True,
    }
    url = os.environ.get("AIMLAPI_BASE_URL", "https://api.aimlapi.com/v1") + "/chat/completions"
    started = time.perf_counter()
    first: float | None = None
    text = ""
    reasoning = 0
    try:
        async with session.post(
            url,
            json=body,
            headers={"Authorization": f"Bearer {os.environ['AIMLAPI_API_KEY']}"},
            timeout=aiohttp.ClientTimeout(total=120),
        ) as response:
            if response.status != 200:
                detail = (await response.text())[:120]
                return {"model": model, "error": f"HTTP {response.status}", "body": detail}
            async for raw in response.content:
                line = raw.strip()
                if not line.startswith(b"data:"):
                    continue
                chunk = line[5:].strip()
                if chunk == b"[DONE]":
                    break
                try:
                    parsed = json.loads(chunk)
                except ValueError:
                    continue
                for choice in parsed.get("choices", []):
                    delta = choice.get("delta") or {}
                    reasoning += len(delta.get("reasoning_content") or "")
                    content = delta.get("content")
                    if content:
                        if first is None:
                            first = (time.perf_counter() - started) * 1000
                        text += content
    except Exception as exc:  # noqa: BLE001
        return {"model": model, "error": f"{type(exc).__name__}: {exc}"[:140]}

    total = (time.perf_counter() - started) * 1000
    check = policy.validate_reply_script(text)
    return {
        "model": model,
        "first_token_ms": round(first) if first else None,
        "total_ms": round(total),
        "chars": len(text),
        "script_ok": check.valid,
        "reasoning_chars": reasoning,
        "text": text[:110],
    }


async def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

    load_env()
    language = os.environ.get("PROBE_LANGUAGE", "asm")
    policy = get_policy(language)
    print(
        f"language={language} budget={policy.max_turn_chars}chars "
        f"prompt={len(policy.system_prompt)}chars\n"
    )

    rows: list[dict] = []
    async with aiohttp.ClientSession() as session:
        for model in CANDIDATES:
            row = await measure(session, model, policy, PROMPTS[language])
            rows.append(row)
            if row.get("error"):
                print(f"{model:34} ERROR {row['error']} {row.get('body','')}")
                continue
            print(
                f"{model:34} first={str(row['first_token_ms']):>6}ms  "
                f"total={row['total_ms']:>6}ms  chars={row['chars']:>4}  "
                f"script_ok={row['script_ok']}  reasoning={row['reasoning_chars']}"
            )
            print(f"{'':34} {row['text']!r}")

    usable = [r for r in rows if not r.get("error") and r.get("script_ok")]
    if usable:
        fastest = min(usable, key=lambda r: r["first_token_ms"] or 10**9)
        print(f"\nfastest that speaks the right script: {fastest['model']} "
              f"({fastest['first_token_ms']}ms to first token)")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
