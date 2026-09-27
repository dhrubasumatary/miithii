"""Production Modal entrypoint for Miithii's Cloudflare PCM voice runtime."""

from __future__ import annotations

import os
from pathlib import Path

import modal

SERVICE_DIR = Path(__file__).resolve().parent
MODAL_APP_NAME = os.environ.get("MIITHII_MODAL_APP_NAME", "miithii-voice-pcm").strip()
DEPLOY_REVISION = os.environ.get("MIITHII_DEPLOY_REVISION", "dev").strip()

runtime_image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("ffmpeg")
    .pip_install(
        "aiohttp>=3.13,<4",
        "python-dotenv>=1,<2",
        "pipecat-ai[silero]==1.10.0",
        "fastapi>=0.118,<1",
    )
    .run_commands("python -m nltk.downloader -d /usr/local/nltk_data punkt_tab")
    .env({"MIITHII_DEPLOY_REVISION": DEPLOY_REVISION, "NLTK_DATA": "/usr/local/nltk_data"})
    .add_local_file(str(SERVICE_DIR / "bot.py"), remote_path="/root/bot.py")
    .add_local_dir(str(SERVICE_DIR / "miithii_voice"), remote_path="/root/miithii_voice")
    .add_local_dir(str(SERVICE_DIR / "contracts"), remote_path="/root/contracts")
)

app = modal.App(MODAL_APP_NAME)
voice_secret = modal.Secret.from_name("miithii-voice")
realtime_secret = modal.Secret.from_name("miithii-realtime")


@app.function(
    image=runtime_image,
    secrets=[voice_secret, realtime_secret],
    min_containers=0,
    max_containers=1,
    scaledown_window=300,
    region="ap",
    timeout=1500,
)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def connect_app():
    """Serve the signed PCM session control plane and Cloudflare WSS media endpoints."""

    from miithii_voice.pcm_app import configure_runtime_logging, create_pcm_app

    configure_runtime_logging()
    os.environ["MIITHII_DEV_NO_AUTH"] = "false"
    os.environ["MIITHII_API_URL"] = "https://api.miithii.in"
    return create_pcm_app()
