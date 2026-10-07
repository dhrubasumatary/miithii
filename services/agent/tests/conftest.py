"""Suite-wide isolation for cached language-pack readers."""

from __future__ import annotations

import pytest

from miithii_agent.policy import clear_language_caches


@pytest.fixture(autouse=True)
def _clear_language_pack_caches() -> None:
    clear_language_caches()
    yield
    clear_language_caches()
