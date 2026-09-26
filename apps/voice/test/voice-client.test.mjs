import assert from "node:assert/strict";
import test from "node:test";

import { MicRecorder } from "../src/lib/mic-recorder.ts";
import { acceptsPushToTalkTarget, ownsVoiceTurn, selectVoiceHistory } from "../src/lib/voice-lifecycle.ts";

test("a cancelled pending permission request stops a late microphone stream", async () => {
  let grantPermission;
  let stopped = 0;
  const permission = new Promise(resolve => { grantPermission = resolve; });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia: () => permission } }
  });
  globalThis.AudioContext = class { constructor() { throw new Error("must not create audio context after cancellation"); } };

  const recorder = new MicRecorder();
  const starting = recorder.start();
  await recorder.abort();
  grantPermission({ getTracks: () => [{ stop: () => { stopped += 1; } }] });
  await starting;

  assert.equal(stopped, 1);
  assert.equal(recorder.durationSeconds, 0);
});

test("turn ownership rejects aborted, stale-session and stale-turn results", () => {
  const active = new AbortController();
  assert.equal(ownsVoiceTurn(active.signal, 2, 2, 7, 7), true);
  assert.equal(ownsVoiceTurn(active.signal, 2, 3, 7, 7), false);
  assert.equal(ownsVoiceTurn(active.signal, 2, 2, 7, 8), false);
  active.abort();
  assert.equal(ownsVoiceTurn(active.signal, 2, 2, 7, 7), false);
});

test("push-to-talk accepts the page but ignores interactive controls", () => {
  assert.equal(acceptsPushToTalkTarget("DIV"), true);
  assert.equal(acceptsPushToTalkTarget("body"), true);
  for (const tag of ["button", "INPUT", "textarea", "select", "a"]) {
    assert.equal(acceptsPushToTalkTarget(tag), false);
  }
});

test("language switching never feeds another reply language back into the model", () => {
  const history = [
    { role: "user", text: "first question" },
    { role: "assistant", text: "অসমীয়া উত্তৰ", language: "as" },
    { role: "user", text: "second question" },
    { role: "assistant", text: "बरʼ फिननाय", language: "brx" }
  ];
  assert.deepEqual(
    selectVoiceHistory(history, "as").map(turn => turn.text),
    ["first question", "অসমীয়া উত্তৰ", "second question"]
  );
  assert.deepEqual(
    selectVoiceHistory(history, "brx").map(turn => turn.text),
    ["first question", "second question", "बरʼ फिननाय"]
  );
});
