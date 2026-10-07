from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path
from typing import Any

import modal

AGENT_DIR = Path(__file__).resolve().parent

# The compiled language-pack artifact lives inside the repo at development time and is mounted
# at a fixed path in the container. The same bytes are consumed by TypeScript and Python.
REPO_ROOT = AGENT_DIR.parent.parent
REPO_PACKS = REPO_ROOT / "packages" / "language-packs" / "compiled" / "language-packs.json"
CONTAINER_PACKS = Path("/root/language-packs/language-packs.json")
PACKS_PATH = REPO_PACKS if REPO_PACKS.exists() else CONTAINER_PACKS

if not PACKS_PATH.exists():  # pragma: no cover - fails the deploy, which is the point
    raise FileNotFoundError(
        f"compiled language packs not found at {REPO_PACKS} or {CONTAINER_PACKS}"
    )

app = modal.App("miithii-livekit-agent")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git")
    .uv_pip_install(
        "livekit-agents[codecs]==1.8.3",
        "livekit-plugins-google==1.8.3",
        "livekit-plugins-openai==1.8.3",
        "livekit-plugins-sarvam==1.8.3",
        "livekit-plugins-silero==1.8.3",
        # `fastapi_endpoint` is the current Modal web decorator (`web_endpoint` was removed),
        # and it runs on FastAPI, so FastAPI has to be in the image.
        "fastapi==0.115.6",
        # The image resolves a looser dependency set than the local venv, and two of these
        # break at import time there and nowhere else:
        #   protobuf - livekit-api ships gencode newer than the resolver's runtime, which
        #              refuses to load older gencode;
        #   aiohttp  - livekit-agents constructs ClientSession(proxy=...), which the older
        #              aiohttp the resolver picks does not accept.
        # Pinning both to what the verified local environment uses removes the whole class of
        # "works on my machine" container failures.
        "protobuf>=6.30",
        "aiohttp>=3.12",
    )
    # The upstream workspace declares sibling plugins as Git URL dependencies. Resolve
    # the pinned 1.8.3 stack above, then install only this v4-aware official plugin.
    # Its sole requirement is livekit-agents[codecs]>=1.8.3, satisfied above.
    .uv_pip_install(
        "livekit-plugins-elevenlabs @ git+https://github.com/livekit/agents.git@7d3a90714fe6b4d7310413def76a23d8e53e2bff#subdirectory=livekit-plugins/livekit-plugins-elevenlabs",
        extra_options="--no-deps",
    )
    .add_local_dir(AGENT_DIR / "miithii_agent", remote_path="/root/miithii_agent", copy=True)
    .add_local_file(PACKS_PATH, remote_path="/root/language-packs/language-packs.json", copy=True)
)

runtime_secret = modal.Secret.from_name("miithii-livekit-agent-secrets")
elevenlabs_secret = modal.Secret.from_name("miithii-elevenlabs-assamese")
# Apply the measured model route after older runtime secrets, which may contain a probe model.
llm_route_secret = modal.Secret.from_name("miithii-llm-route")


@app.server(
    name="agent",
    image=image,
    secrets=[runtime_secret, elevenlabs_secret, llm_route_secret],
    port=8081,
    cpu=1.0,
    memory=2048,
    min_containers=1,
    max_containers=1,
    target_concurrency=0,
    # Keep ingress close to India, but do not make the agent unavailable just because one Modal
    # compute region has no CPU capacity. Modal explicitly supports a region sequence/pool here;
    # `ap` lets the warm worker land elsewhere in Asia-Pacific when ap-south is saturated.
    routing_region="ap-south",
    compute_region=["ap"],
    startup_timeout=120,
)
class LiveKitAgentHost:
    @modal.enter()
    def start(self) -> None:
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["MIITHII_LANGUAGE_PACKS_PATH"] = "/root/language-packs/language-packs.json"
        self.process = subprocess.Popen(
            [sys.executable, "-m", "miithii_agent.main", "start"],
            cwd="/root",
            env=env,
        )

    @modal.exit()
    def stop(self) -> None:
        if self.process.poll() is not None:
            return
        self.process.send_signal(signal.SIGTERM)
        try:
            self.process.wait(timeout=35)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=5)


# The app needs a signed LiveKit join token and must never hold the signing secret. This is
# the whole replacement for the retired api.miithii.in token route: one stateless function
# that picks the room and the grants and signs. LiveKit's standardized request still carries
# ``room_config`` so named-agent dispatch survives. The token boundary restricts that dispatch to
# the configured Miithii worker and fixes the client participant limit; room identity, language,
# media grants, and effective tier remain server-authored.
#
# It is unauthenticated and therefore a development convenience, not production admission.
# Production needs an authenticated front door.
@app.function(
    name="token",
    image=image,
    secrets=[runtime_secret],
    cpu=0.5,
    memory=512,
    # A stateless token request has no reason to hold a container warm. It scales to zero and
    # starts on demand, which is also the cheap default for something this small.
    min_containers=0,
    max_containers=2,
    timeout=30,
)
# LiveKit's standardized token endpoint. The client SDKs package agent dispatch into
# `room_config` before sending the request, so this forwards it verbatim; rebuilding it is
# what made the worker register without ever being dispatched a session.
@modal.fastapi_endpoint(method="POST")
async def issue_token(request: dict) -> Any:
    from fastapi import HTTPException
    from fastapi.responses import JSONResponse

    from miithii_agent.token import TokenError, TokenRequest, build_token

    try:
        payload = build_token(TokenRequest.from_body(request or {}))
    except TokenError as exc:
        # A bad language is the caller's fault.
        raise HTTPException(status_code=400, detail=str(exc)) from None
    except RuntimeError as exc:
        # Missing signing credentials are a server fault, and must not look like a bad request.
        raise HTTPException(status_code=503, detail=str(exc)) from None

    # LiveKit's token endpoint contract specifies 201 Created. Modal's decorator does not take
    # a status code, so the response is built explicitly rather than defaulting to 200.
    return JSONResponse(status_code=201, content=payload)
