"""Measure how often the model drifts out of the required script, per language.

The eval harness reports a pass/fail per case, but the number that matters for the product is
the *rate* and the *kind* of drift. "Mixed script" and "answered in Marathi" need different
fixes, so this separates them.
"""

from __future__ import annotations

import json
import sys
import unicodedata
from collections import Counter
from pathlib import Path

SCRIPTS = ("BENGALI", "DEVANAGARI", "LATIN")


def script_of(char: str) -> str | None:
    if not char.isalpha():
        return None
    name = unicodedata.name(char, "")
    for script in SCRIPTS:
        if name.startswith(f"{script} "):
            return script
    return None


def analyse(text: str) -> tuple[Counter, float]:
    counts: Counter = Counter()
    for char in text:
        script = script_of(char)
        if script:
            counts[script] += 1
    total = sum(counts.values())
    return counts, (counts["DEVANAGARI"] / total * 100 if total else 0.0)


def main() -> int:
    tmp = Path(__file__).resolve().parents[3] / "tmp"
    files = sorted(tmp.glob("language-eval-*.jsonl"), key=lambda p: p.stat().st_mtime)
    if not files:
        print("no eval output found; run the language evaluator first")
        return 1

    latest = files[-1]
    rows = [json.loads(line) for line in latest.read_text(encoding="utf-8").splitlines() if line]
    structured = [row for row in rows if row.get("condition") == "structured"]
    minimal = [row for row in rows if row.get("condition") == "minimal"]

    print(f"{latest.name}\n")
    for label, group in (("structured", structured), ("minimal", minimal)):
        if not group:
            continue
        drifted = 0
        dev_total: list[float] = []
        print(f"--- {label} ({len(group)} cases) ---")
        for row in group:
            text = row.get("text", "")
            counts, dev_pct = analyse(text)
            dev_total.append(dev_pct)
            drift = row.get("problems") or []
            if drift:
                drifted += 1
            flag = "  <-- " + "; ".join(drift) if drift else ""
            print(
                f"  {row['prompt']['id'][:24]:24} "
                f"B={counts['BENGALI']:4} D={counts['DEVANAGARI']:4} L={counts['LATIN']:4}"
                f"{flag}"
            )
        mean = sum(dev_total) / len(dev_total) if dev_total else 0
        print(f"  => {drifted}/{len(group)} flagged, mean Devanagari {mean:.1f}%\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
