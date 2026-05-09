import { useState, useEffect, useRef, useCallback } from "react";

const VOLUME_THRESHOLD = 3.5;
const SILENCE_DURATION_MS = 1200;
const SAMPLE_RATE = 16000;
const MIN_BLOB_SIZE = 1000;

/**
 * useWhisper — offline VAD + Whisper STT hook.
 *
 * Callbacks:
 *   onResult(response, meta)   — final command result from backend
 *   onError(message)           — error string
 *   onStatusChange(status)     — human-readable status label
 *   onSpeakingChange(bool)     — called immediately when speech start/stop detected
 *   onInterimText(text)        — called with live partial text while speaking
 */
export function useWhisper({
  onResult,
  onError,
  onStatusChange,
  onSpeakingChange,
  onInterimText,
}) {
  const [isListening, setIsListening]     = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking]       = useState(false);
  const [workerReady, setWorkerReady]     = useState(false);
  const [lastLatency, setLastLatency]     = useState(null);

  const workerRef      = useRef(null);
  const audioCtxRef    = useRef(null);
  const streamRef      = useRef(null);
  const recorderRef    = useRef(null);
  const chunksRef      = useRef([]);
  const silenceTimerRef = useRef(null);

  const isSpeakingRef   = useRef(false);
  const isListeningRef  = useRef(false);
  const isProcessingRef = useRef(false); // true while a chunk is in-flight to the backend

  // stable refs so callbacks don't cause worker re-init
  const onResultRef         = useRef(onResult);
  const onErrorRef          = useRef(onError);
  const onStatusChangeRef   = useRef(onStatusChange);
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  const onInterimTextRef    = useRef(onInterimText);

  useEffect(() => { onResultRef.current         = onResult; },         [onResult]);
  useEffect(() => { onErrorRef.current          = onError; },          [onError]);
  useEffect(() => { onStatusChangeRef.current   = onStatusChange; },   [onStatusChange]);
  useEffect(() => { onSpeakingChangeRef.current = onSpeakingChange; }, [onSpeakingChange]);
  useEffect(() => { onInterimTextRef.current    = onInterimText; },    [onInterimText]);

  // ---------- Worker init (once) ----------
  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/whisperWorker.js", import.meta.url),
      { type: "module" },
    );

    worker.addEventListener("message", (event) => {
      const { type, response, latency, message } = event.data;

      switch (type) {
        case "WORKER_READY":
          setWorkerReady(true);
          onStatusChangeRef.current?.("Offline Whisper ready");
          break;

        case "TRANSCRIBING":
          setIsTranscribing(true);
          isProcessingRef.current = true;
          onStatusChangeRef.current?.("Processing voice...");
          // clear interim "Recording..." text
          onInterimTextRef.current?.("");
          break;

        case "COMMAND_RESULT":
          isProcessingRef.current = false;
          setIsTranscribing(false);
          setLastLatency(latency);
          onResultRef.current?.(response, { latency });

          if (response?.status === "executed") {
            onStatusChangeRef.current?.(`${response.intent} executed`);
          } else if (response?.status === "ignored") {
            onStatusChangeRef.current?.(response.detail || "Command ignored");
          } else {
            onStatusChangeRef.current?.(response?.detail || "Offline processing failed");
          }
          break;

        case "CHUNK_SKIPPED":
          isProcessingRef.current = false;
          setIsTranscribing(false);
          if (isListeningRef.current) {
            onStatusChangeRef.current?.("Listening...");
          }
          break;

        case "TRANSCRIBE_ERROR":
          isProcessingRef.current = false;
          setIsTranscribing(false);
          onErrorRef.current?.(`Error: ${message}`);
          onStatusChangeRef.current?.("Offline transcription failed");
          break;

        default:
          break;
      }
    });

    workerRef.current = worker;
    return () => worker.terminate();
  }, []); // run once — uses stable refs for callbacks

  // ---------- startListening ----------
  const startListening = useCallback(async () => {
    if (!workerReady) {
      onErrorRef.current?.("Worker not ready. Please wait.");
      return;
    }
    if (isListeningRef.current) return;

    try {
      onStatusChangeRef.current?.("Requesting microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      } else {
        await audioCtxRef.current.resume();
      }

      const audioCtx = audioCtxRef.current;
      await audioCtx.audioWorklet.addModule("/vadProcessor.js");

      const source  = audioCtx.createMediaStreamSource(stream);
      const vadNode = new AudioWorkletNode(audioCtx, "vad-processor");

      vadNode.port.onmessage = (event) => {
        handleVolume(event.data.rms);
      };

      source.connect(vadNode);

      isListeningRef.current = true;
      setIsListening(true);
      onStatusChangeRef.current?.("Listening...");
    } catch (err) {
      onErrorRef.current?.(`Microphone error: ${err.message}`);
      onStatusChangeRef.current?.("Microphone unavailable");
    }
  }, [workerReady]); // only depends on workerReady

  // ---------- stopListening ----------
  const stopListening = useCallback(() => {
    isListeningRef.current  = false;
    isSpeakingRef.current   = false;
    isProcessingRef.current = false;

    // Tell the worker to release its busy lock so it's ready for the next session.
    workerRef.current?.postMessage({ type: "RESET" });

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioCtxRef.current?.suspend();

    streamRef.current  = null;
    recorderRef.current = null;
    chunksRef.current  = [];

    setIsListening(false);
    setIsSpeaking(false);
    setIsTranscribing(false);
    onSpeakingChangeRef.current?.(false);
    onInterimTextRef.current?.("");
    onStatusChangeRef.current?.("Stopped");
  }, []);

  // ---------- startRecording ----------
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: "audio/webm;codecs=opus",
    });

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size > 0) {
        chunksRef.current.push(event.data);
      }
    });

    recorder.addEventListener("stop", async () => {
      try {
        const webmBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (webmBlob.size < MIN_BLOB_SIZE) return;

        const decodeCtx   = new AudioContext({ sampleRate: SAMPLE_RATE });
        const arrayBuffer = await webmBlob.arrayBuffer();
        const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
        await decodeCtx.close();

        const wavBuffer = encodeWAV(audioBuffer);
        const wavBlob   = new Blob([wavBuffer], { type: "audio/wav" });

        workerRef.current?.postMessage({
          type: "TRANSCRIBE_CHUNK",
          payload: { audioBlob: wavBlob },
        });
      } catch (err) {
        onErrorRef.current?.(`Audio processing failed: ${err.message}`);
        onStatusChangeRef.current?.("Audio processing failed");
      }
    });

    recorder.start(100);
    recorderRef.current = recorder;
  }, []);

  // ---------- stopRecording ----------
  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  // ---------- handleVolume (VAD) ----------
  const handleVolume = useCallback((rms) => {
    if (!isListeningRef.current) return;
    // Guard: don't start a new recording while a command is being processed.
    if (isProcessingRef.current) return;

    if (rms > VOLUME_THRESHOLD) {
      if (!isSpeakingRef.current) {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
        onSpeakingChangeRef.current?.(true);
        onStatusChangeRef.current?.("Recording...");
        onInterimTextRef.current?.("🎙 Recording...");
        startRecording();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } else if (isSpeakingRef.current && !silenceTimerRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        onSpeakingChangeRef.current?.(false);
        onInterimTextRef.current?.("⏳ Processing...");
        stopRecording();
        silenceTimerRef.current = null;
      }, SILENCE_DURATION_MS);
    }
  }, [startRecording, stopRecording]);

  return {
    isListening,
    isTranscribing,
    isSpeaking,
    workerReady,
    lastLatency,
    startListening,
    stopListening,
  };
}

// ---------- WAV encoder ----------
function encodeWAV(audioBuffer) {
  const numChannels = 1;
  const sampleRate  = audioBuffer.sampleRate;
  const bitDepth    = 16;
  const channelData = audioBuffer.getChannelData(0);
  const samples     = new Int16Array(channelData.length);

  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    samples[i] = s < 0 ? s * 32768 : s * 32767;
  }

  const dataSize = samples.byteLength;
  const buffer   = new ArrayBuffer(44 + dataSize);
  const view     = new DataView(buffer);

  const writeStr = (offset, value) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeStr(0,  "RIFF");
  view.setUint32(4,  36 + dataSize, true);
  writeStr(8,  "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  new Int16Array(buffer, 44).set(samples);

  return buffer;
}
