import { useCallback, useEffect, useRef, useState } from 'react'
import { useWhisper } from '../hooks/useWhisper'

const DEMO_COMMANDS = [
  'Take off 10 meters',
  'Move forward 5',
  'Rotate right 90 degrees',
  'Return to Home',
  'Land now',
  'Hold position',
]

const DEFAULT_TEL = {
  altitude:    0,
  groundspeed: 0,
  airspeed:    0,
  battPct:     null,
  battVolt:    null,
  lat:         35.363261,
  lon:         149.16523,
  mode:        'GUIDED',
  heading:     0,
  roll:        0,
  pitch:       0,
  armed:       false,
  satellites:  0,
  gps_fix:     0,
  connected:   false,
}

const MODE_COLORS = {
  GUIDED:    '#10b981',
  LAND:      '#f59e0b',
  RTL:       '#00e5ff',
  BRAKE:     '#ef4444',
  STABILIZE: '#a78bfa',
  LOITER:    '#38bdf8',
  ALT_HOLD:  '#fb923c',
  AUTO:      '#34d399',
  UNKNOWN:   '#475569',
}

// ─── Gauge bar ───────────────────────────────────────────────────────────────
function Gauge({ label, value, max, unit, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem' }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontWeight: 700, fontFamily: 'var(--mono)' }}>{value}{unit}</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ─── Attitude indicator (artificial horizon) ─────────────────────────────────
function AttitudeWidget({ roll, pitch }) {
  return (
    <div style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.12)', flexShrink: 0, background: '#0d1b2a' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(${roll}deg, #1565c0 50%, #5d4037 50%)`,
        transform: `translateY(${pitch * 0.6}px)`,
        transition: 'transform 0.4s ease, background 0.4s ease',
      }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 30, height: 1, background: '#ffeb3b' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 1, height: 8, background: '#ffeb3b' }} />
      </div>
    </div>
  )
}

// ─── Compass ──────────────────────────────────────────────────────────────────
function Compass({ heading }) {
  return (
    <div style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.12)', flexShrink: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        {['N','E','S','W'].map((d, i) => {
          const angle = i * 90
          const rad   = (angle - 90) * Math.PI / 180
          const x     = 38 + 28 * Math.cos(rad)
          const y     = 38 + 28 * Math.sin(rad)
          return <text key={d} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill={d === 'N' ? '#ef4444' : '#64748b'} fontSize="9" fontWeight="700">{d}</text>
        })}
        <line
          x1="38" y1="38"
          x2={38 + 22 * Math.cos((heading - 90) * Math.PI / 180)}
          y2={38 + 22 * Math.sin((heading - 90) * Math.PI / 180)}
          stroke="#00e5ff" strokeWidth="2" strokeLinecap="round"
          style={{ transition: 'all 0.5s ease' }}
        />
        <circle cx="38" cy="38" r="3" fill="#00e5ff" />
      </svg>
    </div>
  )
}

// ─── Mini waveform bars ───────────────────────────────────────────────────────
function WaveformBars({ active, color = '#00e5ff' }) {
  const [bars, setBars] = useState(Array(16).fill(4))
  useEffect(() => {
    if (!active) { setBars(Array(16).fill(4)); return }
    const id = setInterval(() => {
      setBars(Array(16).fill(0).map(() => Math.floor(Math.random() * 26) + 4))
    }, 80)
    return () => clearInterval(id)
  }, [active])
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28 }}>
      {bars.map((h, i) => (
        <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: active ? color : 'rgba(255,255,255,0.1)', transition: 'height 0.08s ease' }} />
      ))}
    </div>
  )
}

// ─── Network state ────────────────────────────────────────────────────────────
function getConnectionState() {
  const conn      = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  const isOnline  = navigator.onLine
  const effType   = conn?.effectiveType || 'unknown'
  const rtt       = typeof conn?.rtt === 'number' ? conn.rtt : null
  const goodConn  = conn ? !['slow-2g', '2g'].includes(effType) && (rtt === null || rtt < 1200) : true
  return { isOnline, effectiveType: effType, rtt, useOnline: isOnline && goodConn }
}

function resultStatus(result) {
  if (!result) return 'Awaiting command...'
  if (result.status === 'executed') return `✅ ${result.intent?.replaceAll('_', ' ')} executed`
  if (result.status === 'ignored')  return result.detail || 'Command ignored'
  return result.detail || 'Request failed'
}

function engineLabel(mode) {
  return mode === 'online' ? '⚡ ONLINE (Fast)' : '📡 OFFLINE (Local)'
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LiveDemoSection() {
  const [inputText,            setInputText]            = useState('')
  const [interimText,          setInterimText]          = useState('')   // live "Recording..." feedback
  const [micActive,            setMicActive]            = useState(false)
  const [modePreference,       setModePreference]       = useState('auto')
  const [fallbackMode,         setFallbackMode]         = useState(null)
  const [offlineAutoStartToken,setOfflineAutoStartToken] = useState(0)
  const [sttLabel,             setSttLabel]             = useState('Hybrid controller ready.')
  const [log,                  setLog]                  = useState([])
  const [tel,                  setTel]                  = useState(DEFAULT_TEL)
  const [backendOk,            setBackendOk]            = useState(null)
  const [liveMode,             setLiveMode]             = useState(false)
  const [networkState,         setNetworkState]         = useState(getConnectionState())
  const [commandPending,       setCommandPending]       = useState(false)
  const [offlineSpeaking,      setOfflineSpeaking]      = useState(false)
  const [offlineListening,     setOfflineListening]     = useState(false)
  const [offlineTranscribing,  setOfflineTranscribing]  = useState(false)
  const [ttsEnabled,           setTtsEnabled]           = useState(false)  // OFF by default — prevents mic feedback loop

  const srRef            = useRef(null)
  const shouldListenRef  = useRef(false)
  const logRef           = useRef(null)
  const esRef            = useRef(null)

  const autoMode   = networkState.useOnline ? 'online' : 'offline'
  const activeMode = fallbackMode || (modePreference === 'auto' ? autoMode : modePreference)
  const modeColor  = MODE_COLORS[tel.mode] || '#475569'

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const addLog = useCallback((entry, legacyType = 'info') => {
    const ts = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    if (typeof entry === 'string') {
      // legacy string support — preserves warn/ok/cmd coloring
      setLog(curr => [...curr.slice(-49), { msg: entry, type: legacyType, ts }])
    } else {
      setLog(curr => [...curr.slice(-49), { ...entry, ts: entry.ts || ts }])
    }
  }, [])

  const speak = useCallback((text) => {
    if (!ttsEnabled) return                          // TOGGLE: silent when off
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()                  // cancel any in-progress speech
    const msg = new SpeechSynthesisUtterance(text)
    msg.rate  = 1.08; msg.pitch = 0.95
    window.speechSynthesis.speak(msg)
  }, [ttsEnabled])

  // ─── Offline Whisper hook (always mounted, activated by mode) ────────────
  const {
    isListening:    whisperListening,
    isTranscribing: whisperTranscribing,
    isSpeaking:     whisperSpeaking,
    workerReady:    whisperReady,
    lastLatency:    whisperLatency,
    startListening: startWhisper,
    stopListening:  stopWhisper,
  } = useWhisper({
    onResult: useCallback((response, meta) => {
      const text = response?.text || ''
      // Clear input immediately after result — command lives in log only
      setInputText('')
      setInterimText('')
      setCommandPending(false)

      const totalMs = meta?.totalLatencyMs ?? 0
      const execMs  = response?.exec_latency_ms ?? 0
      const conf    = response?.confidence ?? null
      const intent  = response?.intent || 'UNKNOWN'
      const value   = response?.value ?? null
      const detail  = response?.detail || ''
      const modeStr = 'offline'

      // FIX: Stop listening after a result is received to prevent continuous looping
      // and hallucinated repeated commands from background noise.
      stopWhisper()
      setMicActive(false)

      if (response?.status === 'executed') {
        addLog({
          type: 'ok',
          text,
          intent,
          value,
          detail,
          status: 'success',
          totalLatencyMs: totalMs,
          execLatencyMs: execMs,
          confidence: conf,
          mode: modeStr,
        })
        speak(detail || `${intent.replaceAll('_', ' ').toLowerCase()} executed`)
        setSttLabel(`✅ ${intent} executed`)
      } else if (response?.status === 'ignored') {
        addLog({
          type: 'warn',
          text,
          intent,
          value,
          detail,
          status: 'ignored',
          totalLatencyMs: totalMs,
          execLatencyMs: execMs,
          confidence: conf,
          mode: modeStr,
        })
        setSttLabel(response.detail || 'Command not recognized')
      } else {
        addLog({
          type: 'warn',
          text,
          intent: 'UNKNOWN',
          value: null,
          detail: response?.detail || 'Request failed',
          status: 'error',
          totalLatencyMs: totalMs,
          execLatencyMs: execMs,
          confidence: conf,
          mode: modeStr,
        })
        setSttLabel(response?.detail || 'Request failed')
      }
    }, [addLog, speak]),

    onError: useCallback((msg) => {
      setSttLabel(msg)
      addLog(msg, 'warn')
    }, [addLog]),

    onStatusChange: useCallback((status) => {
      setSttLabel(status)
    }, []),

    onSpeakingChange: useCallback((speaking) => {
      setOfflineSpeaking(speaking)
      if (speaking) setCommandPending(true)
    }, []),

    onInterimText: useCallback((text) => {
      setInterimText(text)
    }, []),
  })

  // sync offline state badges
  useEffect(() => { setOfflineListening(whisperListening) },    [whisperListening])
  useEffect(() => { setOfflineTranscribing(whisperTranscribing) }, [whisperTranscribing])

  // ─── Online Web Speech ────────────────────────────────────────────────────
  const stopOnlineListening = useCallback((message = 'System stopped.') => {
    shouldListenRef.current = false
    setMicActive(false)
    setCommandPending(false)
    setSttLabel(message)
    setInterimText('')
    if (srRef.current) {
      try { srRef.current.onresult = null; srRef.current.onerror = null; srRef.current.onend = null; srRef.current.stop() } catch (_) {}
      srRef.current = null
    }
  }, [])

  const fallbackToOffline = useCallback((reason) => {
    stopOnlineListening(`${reason}. Switching to Whisper...`)
    setFallbackMode('offline')
    setOfflineAutoStartToken(v => v + 1)
    addLog(`${reason} — falling back to offline Whisper.`, 'warn')
  }, [addLog, stopOnlineListening])

  const applyCommandResult = useCallback((result, source = 'manual', totalLatencyMs = 0) => {
    setCommandPending(false)
    // Clear input immediately — command lives in the log only
    setInputText('')
    setInterimText('')
    setSttLabel(resultStatus(result))

    const execMs  = result?.exec_latency_ms ?? 0
    const conf    = result?.confidence ?? null
    const intent  = result?.intent || 'UNKNOWN'
    const value   = result?.value ?? null
    const detail  = result?.detail || ''
    const modeStr = result?.mode || source
    const text    = result?.text || ''

    if (result?.status === 'executed') {
      addLog({
        type: 'ok',
        text,
        intent,
        value,
        detail,
        status: 'success',
        totalLatencyMs,
        execLatencyMs: execMs,
        confidence: conf,
        mode: modeStr,
      })
      speak(detail || `${intent.replaceAll('_', ' ').toLowerCase()} executed`)
      return
    }
    if (result?.status === 'ignored') {
      addLog({
        type: 'warn',
        text,
        intent,
        value,
        detail,
        status: 'ignored',
        totalLatencyMs,
        execLatencyMs: execMs,
        confidence: conf,
        mode: modeStr,
      })
      return
    }
    addLog({
      type: 'warn',
      text,
      intent: 'UNKNOWN',
      value: null,
      detail: result?.detail || 'Request failed',
      status: 'error',
      totalLatencyMs,
      execLatencyMs: execMs,
      confidence: conf,
      mode: modeStr,
    })
  }, [addLog, speak])

  const executeTextCommand = useCallback(async (text, options = {}) => {
    const trimmed = text.trim()
    if (!trimmed) return null

    setInputText(trimmed)
    setInterimText('')
    addLog({
      type: 'cmd',
      text: trimmed,
      intent: null,
      value: null,
      detail: 'Sending command...',
      status: 'pending',
      totalLatencyMs: null,
      execLatencyMs: null,
      confidence: null,
      mode: options.source || 'manual',
    })
    setCommandPending(true)
    setSttLabel(options.source === 'online' ? 'Processing voice...' : 'Dispatching command...')

    // Cancel any in-progress TTS before sending a new command
    if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
      window.speechSynthesis.cancel()
    }

    const cmdStart = performance.now()

    try {
      const res  = await fetch('/text-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, confidence: Number.isFinite(options.confidence) ? options.confidence : 1 }),
      })
      const data = await res.json()
      const totalLatencyMs = Math.round(performance.now() - cmdStart)
      setBackendOk(true)
      applyCommandResult(data, options.source || 'manual', totalLatencyMs)
      return data
    } catch (_) {
      setBackendOk(false)
      setCommandPending(false)
      setSttLabel('Backend unreachable')
      addLog({
        type: 'warn',
        text: trimmed,
        intent: 'UNKNOWN',
        value: null,
        detail: 'Backend unreachable',
        status: 'error',
        totalLatencyMs: Math.round(performance.now() - cmdStart),
        execLatencyMs: 0,
        confidence: null,
        mode: options.source || 'manual',
      })
      return null
    }
  }, [addLog, applyCommandResult])

  const startOnlineListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { fallbackToOffline('Browser speech recognition unavailable'); return }
    if (micActive) { stopOnlineListening(); return }

    const recognition         = new SR()
    srRef.current             = recognition
    recognition.lang          = 'en-US'
    recognition.continuous    = true
    recognition.interimResults = true    // ← enables real-time interim text
    recognition.maxAlternatives = 1

    shouldListenRef.current = true
    setMicActive(true)
    setSttLabel('Listening...')

    recognition.onresult = async (event) => {
      let interim  = ''
      let finalTxt = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTxt += t
        else interim += t
      }
      if (interim) setInterimText(interim)
      if (finalTxt) {
        const transcript = finalTxt.trim()
        setInterimText('')
        setInputText(transcript)
        await executeTextCommand(transcript, {
          source: 'online',
          confidence: event.results[event.results.length - 1][0].confidence,
        })
        if (shouldListenRef.current) setSttLabel('Listening...')
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') { setSttLabel('No speech detected. Still listening...'); return }
      fallbackToOffline(`Web Speech error: ${event.error}`)
    }

    recognition.onend = () => {
      if (!shouldListenRef.current) { setMicActive(false); return }
      try { recognition.start() } catch (_) { fallbackToOffline('Web Speech restart failed') }
    }

    try { recognition.start() } catch (_) { fallbackToOffline('Web Speech failed to start') }
  }, [executeTextCommand, fallbackToOffline, micActive, stopOnlineListening])

  // ─── Unified mic toggle ───────────────────────────────────────────────────
  const handleMicToggle = useCallback(() => {
    if (activeMode === 'online') {
      startOnlineListening()
    } else {
      // offline mode
      if (offlineListening || whisperListening) {
        stopWhisper()
        setMicActive(false)
        setSttLabel('Microphone stopped.')
      } else {
        if (!whisperReady) { setSttLabel('Whisper not ready yet, please wait...'); return }
        startWhisper()
        setMicActive(true)
        setSttLabel('Listening (offline Whisper)...')
      }
    }
  }, [activeMode, offlineListening, startOnlineListening, startWhisper, stopWhisper, whisperListening, whisperReady])

  // ─── SSE telemetry stream ─────────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    if (esRef.current) { esRef.current.close() }
    const es  = new EventSource('/telemetry/stream')
    esRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setTel(prev => ({
          ...prev,
          connected:   data.connected   ?? prev.connected,
          altitude:    data.altitude    ?? prev.altitude,
          groundspeed: data.groundspeed ?? prev.groundspeed,
          airspeed:    data.airspeed    ?? prev.airspeed,
          battPct:     data.battery_pct  != null ? data.battery_pct : prev.battPct,
          battVolt:    data.battery_volt ?? prev.battVolt,
          lat:         data.lat         ?? prev.lat,
          lon:         data.lon         ?? prev.lon,
          mode:        data.mode        ?? prev.mode,
          heading:     data.heading     ?? prev.heading,
          roll:        data.roll        ?? prev.roll,
          pitch:       data.pitch       ?? prev.pitch,
          armed:       data.armed       ?? prev.armed,
          satellites:  data.satellites  ?? prev.satellites,
          gps_fix:     data.gps_fix     ?? prev.gps_fix,
        }))
        setLiveMode(data.connected === true)
      } catch (_) {}
    }

    es.onerror = () => {
      setLiveMode(false)
      es.close()
      setTimeout(connectSSE, 4000)
    }
  }, [])

  // ─── Effects ──────────────────────────────────────────────────────────────
  // network listener
  useEffect(() => {
    const update = () => setNetworkState(getConnectionState())
    const conn   = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    conn?.addEventListener?.('change', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      conn?.removeEventListener?.('change', update)
    }
  }, [])

  // health probe + SSE start on mount
  useEffect(() => {
    const probe = async () => {
      try {
        const r = await fetch('/health')
        const h = await r.json()
        setBackendOk(h.status === 'ok')
        setTel(prev => ({
          ...prev,
          mode:  h?.drone?.mode  ?? prev.mode,
          armed: h?.drone?.armed ?? prev.armed,
        }))
      } catch (_) {
        setBackendOk(false)
      }
    }
    probe()
    connectSSE()   // ← always start SSE on mount
    return () => esRef.current?.close()
  }, [connectSSE])

  // auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  // auto-start offline when forced
  useEffect(() => {
    if (offlineAutoStartToken > 0 && whisperReady && !whisperListening) {
      startWhisper()
      setMicActive(true)
    }
  }, [offlineAutoStartToken, whisperReady, whisperListening, startWhisper])

  // stop online when switching to offline
  useEffect(() => {
    if (modePreference !== 'auto') setFallbackMode(null)
    if (modePreference !== 'online' && micActive && srRef.current) {
      stopOnlineListening(modePreference === 'offline' ? 'Switched to offline Whisper.' : 'Online listening stopped.')
    }
  }, [micActive, modePreference, stopOnlineListening])

  // network-triggered fallback
  useEffect(() => {
    if (modePreference === 'auto' && micActive && !networkState.useOnline) {
      fallbackToOffline('Connection degraded')
    }
  }, [fallbackToOffline, micActive, modePreference, networkState.useOnline])

  // ─── Derived state ────────────────────────────────────────────────────────
  const statusBadgeColor = backendOk === null ? '#f59e0b' : backendOk ? '#10b981' : '#ef4444'
  const gpsFixed         = tel.gps_fix >= 3
  const isMicOn          = activeMode === 'online' ? micActive : (offlineListening || whisperListening)
  const isSpeakingNow    = activeMode === 'online' ? micActive : offlineSpeaking
  const isProcessingNow  = activeMode === 'offline' && (offlineTranscribing || whisperTranscribing)

  // What to show in the input box
  const displayValue = interimText || inputText

  return (
    <section id='demo' className='section' style={{ zIndex: 1, background: 'linear-gradient(180deg, transparent, rgba(5,13,30,0.95) 15%, rgba(5,13,30,0.95) 85%, transparent)' }}>
      <div className='container'>
        <div className='section-label'>Live Demo</div>
        <h2 className='section-title'>Ground Control Station</h2>

        {/* Status bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <StatusPill label='Backend' value={backendOk === null ? 'Checking...' : backendOk ? 'Healthy' : 'Offline'} color={statusBadgeColor} />
          <StatusPill label='Telemetry' value={liveMode ? '● LIVE' : '○ Simulation'} color={liveMode ? '#00e5ff' : '#f59e0b'} />
          <StatusPill label='Network' value={networkState.isOnline ? `${networkState.effectiveType?.toUpperCase()}` : 'OFFLINE'} color={networkState.useOnline ? '#10b981' : '#ef4444'} />
          {tel.armed && (
            <span style={{ padding: '3px 12px', borderRadius: 50, fontSize: '0.78rem', fontWeight: 700, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', animation: 'glow-pulse 1s infinite' }}>
              ⚡ ARMED
            </span>
          )}

          {/* TTS Voice Reply Toggle */}
          <button
            id='tts-toggle-btn'
            onClick={() => setTtsEnabled(prev => !prev)}
            title={ttsEnabled ? 'Voice reply ON — click to mute' : 'Voice reply OFF — click to enable'}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '6px',
              padding:      '4px 12px',
              borderRadius: '12px',
              border:       `1px solid ${ttsEnabled ? '#66bb6a' : '#444'}`,
              background:   ttsEnabled ? 'rgba(102,187,106,0.12)' : 'rgba(255,255,255,0.04)',
              color:        ttsEnabled ? '#66bb6a' : '#666',
              fontSize:     '12px',
              fontWeight:   '600',
              cursor:       'pointer',
              transition:   'all 0.2s ease',
              whiteSpace:   'nowrap',
            }}
          >
            <span>{ttsEnabled ? '🔊' : '🔇'}</span>
            <span>{ttsEnabled ? 'Voice Reply ON' : 'Voice Reply OFF'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 28, alignItems: 'start' }}>
          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Voice command panel */}
            <div className='glass' style={{ borderRadius: 16, padding: '18px 20px' }}>

              {/* Mode selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: '0.06em' }}>STT MODE:</span>
                {['auto', 'online', 'offline'].map(opt => (
                  <button key={opt} onClick={() => setModePreference(opt)} style={{
                    padding: '6px 14px', borderRadius: 20,
                    border: `1px solid ${modePreference === opt ? '#00e5ff' : 'rgba(255,255,255,0.12)'}`,
                    background: modePreference === opt ? 'rgba(0,229,255,0.12)' : 'transparent',
                    color: modePreference === opt ? '#00e5ff' : 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase',
                  }}>
                    {opt}
                  </button>
                ))}
                <span className='pill' style={{ color: activeMode === 'offline' ? '#66bb6a' : '#4fc3f7', borderColor: activeMode === 'offline' ? 'rgba(102,187,106,0.3)' : 'rgba(79,195,247,0.3)', fontSize: 11 }}>
                  {engineLabel(activeMode)}
                </span>
                {fallbackMode && <span className='pill' style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)', fontSize: 11 }}>FAILSAFE</span>}
              </div>

              {/* ── Unified mic + input row (same for online & offline) ── */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {/* Mic button */}
                <button
                  id='mic-toggle-btn'
                  onClick={handleMicToggle}
                  title={isMicOn ? 'Stop listening' : 'Start listening'}
                  style={{
                    width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                    background: isMicOn
                      ? isSpeakingNow ? 'rgba(239,68,68,0.25)' : 'rgba(0,229,255,0.15)'
                      : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${isMicOn ? (isSpeakingNow ? '#ef4444' : '#00e5ff') : 'rgba(255,255,255,0.15)'}`,
                    fontSize: '1.3rem',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: isSpeakingNow ? 'glow-pulse 0.8s infinite' : 'none',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {isMicOn ? (isSpeakingNow ? '🔴' : '🎙️') : '🎤'}
                </button>

                {/* Input box — shows interim text live, final text after result */}
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    id='command-input'
                    value={displayValue}
                    onChange={e => { setInputText(e.target.value); setInterimText('') }}
                    onKeyDown={e => e.key === 'Enter' && executeTextCommand(inputText, { source: 'manual', confidence: 1 })}
                    placeholder='Type or speak a command...'
                    style={{
                      width: '100%',
                      background: interimText ? 'rgba(0,229,255,0.04)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${interimText ? 'rgba(0,229,255,0.35)' : 'rgba(0,229,255,0.15)'}`,
                      borderRadius: 10,
                      padding: '11px 14px',
                      fontFamily: 'var(--mono)',
                      fontSize: '0.88rem',
                      color: interimText ? '#94a3b8' : 'var(--text-primary)',
                      fontStyle: interimText ? 'italic' : 'normal',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s ease',
                    }}
                  />
                  {isProcessingNow && (
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#a78bfa', fontWeight: 700 }}>
                      ⏳
                    </div>
                  )}
                </div>

                <button
                  id='send-cmd-btn'
                  onClick={() => executeTextCommand(inputText, { source: 'manual', confidence: 1 })}
                  className='btn btn-primary'
                  disabled={commandPending || !inputText.trim()}
                  style={{ padding: '10px 18px', fontSize: '0.82rem', opacity: (commandPending || !inputText.trim()) ? 0.5 : 1, flexShrink: 0 }}
                >
                  {commandPending ? '...' : 'Send'}
                </button>
              </div>

              {/* Waveform + status row */}
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <WaveformBars active={isSpeakingNow} color={isSpeakingNow ? '#ef4444' : '#00e5ff'} />
                <div style={{ flex: 1, fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)', padding: '4px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, minWidth: 0 }}>
                  <span style={{ color: isMicOn ? (isSpeakingNow ? '#ef4444' : '#00e5ff') : 'var(--text-muted)' }}>
                    {sttLabel}
                  </span>
                </div>
                {activeMode === 'offline' && whisperLatency && (
                  <span style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'var(--mono)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                    {whisperLatency}ms
                  </span>
                )}
              </div>
            </div>

            {/* Quick commands */}
            <div className='glass' style={{ borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                Quick Commands
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {DEMO_COMMANDS.map(cmd => (
                  <button
                    key={cmd}
                    onClick={() => { setInputText(cmd); executeTextCommand(cmd, { source: 'manual', confidence: 1 }) }}
                    style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.12)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', fontSize: '0.73rem', color: 'var(--text-secondary)', fontWeight: 600, transition: 'background 0.2s ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,229,255,0.06)'}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>

            {/* Command log */}
            <div className='glass' style={{ borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(0,229,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontWeight: 700 }}>GCS Command Log</span>
                {log.length > 0 && (
                  <button onClick={() => setLog([])} style={{ fontSize: '0.65rem', color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                )}
              </div>
              <div ref={logRef} style={{ padding: 14, maxHeight: 260, overflowY: 'auto', fontFamily: 'var(--mono)', fontSize: '0.78rem' }}>
                {log.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Awaiting first command...</span>
                ) : (
                  log.map((entry, i) => {
                    // Legacy string entries (info/warn with msg only)
                    if (entry.msg !== undefined && entry.intent === undefined) {
                      return (
                        <div key={i} style={{ padding: '3px 0', color: entry.type === 'cmd' ? '#00e5ff' : entry.type === 'ok' ? '#10b981' : entry.type === 'warn' ? '#f59e0b' : 'var(--text-secondary)' }}>
                          <span style={{ color: '#666666' }}>[{entry.ts}]</span>{' '}{entry.msg}
                        </div>
                      )
                    }

                    // Rich structured entry
                    const statusIcon = entry.status === 'success' ? '🟢' : entry.status === 'error' ? '🔴' : entry.status === 'pending' ? '⏳' : '🟡'
                    const intentStr  = entry.intent || 'UNKNOWN'
                    const valueStr   = entry.value != null
                      ? (intentStr.startsWith('ROTATE') ? `${entry.value}°` : `${entry.value}m`)
                      : '--'

                    const totalMs   = entry.totalLatencyMs
                    const latLabel  = totalMs == null ? '' : totalMs < 2000 ? '(fast)' : totalMs < 5000 ? '(normal)' : totalMs < 15000 ? '(executing)' : '(long manoeuvre)'
                    const latColor  = totalMs == null ? '#666666' : totalMs < 2000 ? '#ffeb3b' : totalMs < 5000 ? '#ffeb3b' : '#ffeb3b'
                    const execColor = '#ff9800'

                    const conf = entry.confidence
                    const confColor = conf == null ? '#666' : conf > 0.7 ? '#66bb6a' : conf > 0.35 ? '#ffa726' : '#ef4444'
                    const confStr   = conf != null ? `${Math.round(conf * 100)}%` : null

                    const modeLabel = (entry.mode || '').toLowerCase()
                    const modeBg    = modeLabel === 'offline' ? '#1b5e20' : '#0d47a1'
                    const modeText  = modeLabel === 'offline' ? '#a5d6a7' : '#90caf9'
                    const modeName  = modeLabel === 'offline' ? 'OFFLINE' : modeLabel === 'online' ? 'ONLINE' : (modeLabel || 'MANUAL').toUpperCase()

                    return (
                      <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {/* Row 1: timestamp + icon + intent → value + detail + mode badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <span style={{ color: '#666666', fontSize: '0.72rem' }}>[{entry.ts}]</span>
                            <span>{statusIcon}</span>
                            <span style={{ color: '#00e5ff', fontWeight: 700 }}>{intentStr}</span>
                            {entry.status !== 'pending' && (
                              <span style={{ color: '#ffffff' }}>→ {valueStr}</span>
                            )}
                            {entry.detail && entry.status !== 'pending' && (
                              <span style={{ color: '#aaaaaa', fontSize: '0.73rem' }}>&nbsp;&quot;{entry.detail}&quot;</span>
                            )}
                          </div>
                          <span style={{ padding: '1px 7px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, background: modeBg, color: modeText, flexShrink: 0 }}>
                            {modeName}
                          </span>
                        </div>
                        {/* Row 2: latency metrics (dimmed) */}
                        {entry.status !== 'pending' && (
                          <div style={{ display: 'flex', gap: 10, fontSize: '0.68rem', color: '#555', marginTop: 2, paddingLeft: 4, flexWrap: 'wrap' }}>
                            {totalMs != null && (
                              <span>
                                Total: <span style={{ color: latColor }}>{totalMs.toLocaleString()}ms</span>
                                {latLabel && <span style={{ color: '#555', marginLeft: 3 }}>{latLabel}</span>}
                              </span>
                            )}
                            {entry.execLatencyMs != null && (
                              <span>Exec: <span style={{ color: execColor }}>{entry.execLatencyMs.toLocaleString()}ms</span></span>
                            )}
                            {confStr && (
                              <span>Conf: <span style={{ color: confColor }}>{confStr}</span></span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── Right column — Telemetry HUD ── */}
          <div className='glass' style={{ borderRadius: 18, overflow: 'hidden', position: 'sticky', top: 20 }}>
            <div style={{ padding: '14px 20px', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(0,229,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Telemetry HUD</span>
                {liveMode && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', display: 'inline-block', animation: 'glow-pulse 1.5s infinite' }} />}
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: `${modeColor}22`, border: `1px solid ${modeColor}44`, color: modeColor }}>
                {tel.mode}
              </span>
            </div>

            <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Big alt + groundspeed */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <BigMetric label='Altitude' value={tel.altitude.toFixed(1)} unit='m' color='#00e5ff' />
                <BigMetric label='Groundspeed' value={tel.groundspeed.toFixed(1)} unit='m/s' color='#10b981' />
              </div>

              {/* Gauges */}
              <Gauge label='Battery' value={(tel.battPct ?? 0).toFixed(0)} max={100} unit='%' color='#f59e0b' />
              <Gauge label='Airspeed' value={tel.airspeed.toFixed(1)} max={20} unit=' m/s' color='#a78bfa' />

              {/* Attitude + Compass row */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0' }}>
                <AttitudeWidget roll={tel.roll} pitch={tel.pitch} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SmallRow label='Roll'  value={`${tel.roll.toFixed(1)}°`}  color='#f59e0b' />
                  <SmallRow label='Pitch' value={`${tel.pitch.toFixed(1)}°`} color='#a78bfa' />
                  <SmallRow label='Hdg'   value={`${tel.heading}°`}           color='#00e5ff' />
                </div>
                <Compass heading={tel.heading} />
              </div>

              {/* Battery voltage */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <MetricCell
                  label='Battery Voltage'
                  value={tel.battVolt != null ? `${tel.battVolt.toFixed(2)} V` : '-- V'}
                  color='#f59e0b'
                />
                <MetricCell
                  label='GPS Fix'
                  value={gpsFixed ? `3D FIX` : `SEARCH`}
                  color={gpsFixed ? '#10b981' : '#f59e0b'}
                  sub={`${tel.satellites} sats`}
                />
              </div>

              {/* GPS coords */}
              <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>
                <span style={{ color: gpsFixed ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                  {gpsFixed ? '📍 GPS LOCKED' : '🔍 Searching...'}
                </span>
                <div style={{ color: '#64748b', marginTop: 3 }}>
                  {tel.lat?.toFixed(6) ?? '--'} , {tel.lon?.toFixed(6) ?? '--'}
                </div>
              </div>

              {/* Drone status */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: tel.armed ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.1)', border: `1px solid ${tel.armed ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.2)'}`, color: tel.armed ? '#ef4444' : '#10b981' }}>
                  {tel.armed ? '⚡ ARMED' : '🔒 DISARMED'}
                </span>
                <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)', color: '#00e5ff' }}>
                  {liveMode ? '📡 LIVE' : '💾 SIM'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          #demo .container > div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}

// ─── Small sub-components ─────────────────────────────────────────────────────
function StatusPill({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
      {label}:
      <span style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

function BigMetric({ label, value, unit, color }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, background: `radial-gradient(circle at 30% 30%, ${color}15, transparent)`, border: `1px solid ${color}30`, textAlign: 'center' }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 900, color, fontFamily: 'var(--mono)', lineHeight: 1 }}>
        {value}<span style={{ fontSize: '0.85rem', fontWeight: 400, marginLeft: 2 }}>{unit}</span>
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}

function SmallRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontWeight: 700, fontFamily: 'var(--mono)' }}>{value}</span>
    </div>
  )
}

function MetricCell({ label, value, color, sub }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.95rem', fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>{label}</div>
    </div>
  )
}
