from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

CONTRACT_PATH = Path(__file__).resolve().parent.parent / "contracts" / "voice-contracts.json"


@dataclass(frozen=True)
class VoiceContract:
    language: str
    locale: str
    language_name: str
    native_name: str
    script: str
    display_script: str
    voice: str
    max_input_chars: int
    generation_max_tokens: int
    policy_version: str


def load_contract(language: str | None = None, path: Path = CONTRACT_PATH) -> VoiceContract:
    payload: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    selected = language or payload["defaultLanguage"]
    contracts = payload["contracts"]
    if selected not in contracts:
        raise ValueError(f"Unsupported Miithii Voice language: {selected}")

    raw = contracts[selected]
    tts = raw["tts"]
    return VoiceContract(
        language=raw["language"],
        locale=raw["locale"],
        language_name=raw["languageName"],
        native_name=raw["nativeName"],
        script=raw["script"],
        display_script=raw["displayScript"],
        voice=tts["voice"],
        max_input_chars=int(tts["maxInputChars"]),
        generation_max_tokens=int(tts["generationMaxTokens"]),
        policy_version=payload["policyVersion"],
    )
