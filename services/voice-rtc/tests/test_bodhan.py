import unittest
from unittest.mock import AsyncMock

from pipecat.frames.frames import TranscriptionFrame

from miithii_voice.bodhan import BodhanSTTService


class _Response:
    status = 200

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def json(self):
        return {"text": "hello from Bodhan"}


class _Session:
    def post(self, *args, **kwargs):
        return _Response()


class BodhanSTTTests(unittest.IsolatedAsyncioTestCase):
    async def test_successful_segment_yields_final_transcription(self):
        service = BodhanSTTService(api_key="test", session=_Session())
        service.start_processing_metrics = AsyncMock()

        frames = [frame async for frame in service.run_stt(b"wav")]

        self.assertEqual(len(frames), 1)
        self.assertIsInstance(frames[0], TranscriptionFrame)
        self.assertEqual(frames[0].text, "hello from Bodhan")
        self.assertTrue(frames[0].finalized)


if __name__ == "__main__":
    unittest.main()
