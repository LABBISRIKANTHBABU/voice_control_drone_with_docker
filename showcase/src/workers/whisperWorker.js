const VAD_MIN_BLOB_SIZE_BYTES = 1000;

// Guard: prevent concurrent requests. Only one transcription in-flight at a time.
let isBusy = false;

self.postMessage({ type: "WORKER_READY" });

self.addEventListener("message", async (event) => {
  const { type, payload } = event.data;
  if (type === "TRANSCRIBE_CHUNK") {
    if (isBusy) {
      // Drop the chunk silently — a command is already being processed.
      self.postMessage({
        type: "CHUNK_SKIPPED",
        reason: "Worker busy — previous command still processing",
      });
      return;
    }
    isBusy = true;
    try {
      await handleTranscribeChunk(payload);
    } finally {
      isBusy = false;
    }
  } else if (type === "RESET") {
    // Allow the parent to manually clear the busy lock (e.g. on stopListening).
    isBusy = false;
  }
});

async function handleTranscribeChunk(payload) {
  const { audioBlob } = payload;

  if (!audioBlob || audioBlob.size < VAD_MIN_BLOB_SIZE_BYTES) {
    self.postMessage({
      type: "CHUNK_SKIPPED",
      reason: `Too small: ${audioBlob?.size || 0} bytes`,
    });
    return;
  }

  self.postMessage({ type: "TRANSCRIBING" });

  const formData = new FormData();
  formData.append("audio", audioBlob, "chunk.wav");

  const t0 = performance.now();

  try {
    const response = await fetch("/voice-command", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    const latency = Math.round(performance.now() - t0);

    self.postMessage({
      type: "COMMAND_RESULT",
      response: data,
      latency,
    });
  } catch (err) {
    self.postMessage({
      type: "TRANSCRIBE_ERROR",
      message: err.message,
    });
  }
}

