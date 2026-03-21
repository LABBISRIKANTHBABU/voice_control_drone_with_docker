import { useState, useRef, useEffect, useCallback } from 'react'

const BACKEND = 'http://localhost:8002'

const DEMO_COMMANDS = [
    { cmd: 'Take off 10 meters', intent: 'TAKEOFF', value: 10 },
    { cmd: 'Move forward 5', intent: 'MOVE_FORWARD', value: 5 },
    { cmd: 'Rotate right 90°', intent: 'ROTATE_CW', value: 90 },
    { cmd: 'Return to Launch', intent: 'RTL', value: null },
    { cmd: 'Land now', intent: 'LAND', value: null },
    { cmd: 'Hold position', intent: 'HOLD', value: null },
]

// ── Default simulated telemetry (used when backend not connected) ──
const DEFAULT_TEL = {
    altitude: 0, groundspeed: 0, airspeed: 0,
    battPct: 87, battVolt: null, lat: 35.363261, lon: 149.165230,
    mode: 'GUIDED', heading: 0, roll: 0, pitch: 0,
    armed: false, satellites: 0, gps_fix: 0,
}

function Gauge({ label, value, max, unit, color }) {
    const pct = Math.min(100, (value / max) * 100)
    return (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                <span style={{ color, fontWeight: 700, fontFamily: 'var(--mono)' }}>{value}{unit}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    borderRadius: 4, transition: 'width 0.5s ease',
                    boxShadow: `0 0 8px ${color}55`,
                }} />
            </div>
        </div>
    )
}

const MODE_COLORS = { GUIDED: '#10b981', LAND: '#f59e0b', RTL: '#00e5ff', BRAKE: '#ef4444', STABILIZE: '#a78bfa', UNKNOWN: '#475569' }

export default function LiveDemoSection() {
    const [inputText, setInputText] = useState('')
    const [micActive, setMicActive] = useState(false)
    const [sttMode, setSttMode] = useState('whisper')  // 'whisper' | 'online'
    const [recProgress, setRecProgress] = useState(0)       // 0-100 recording fill
    const [sttLabel, setSttLabel] = useState('')      // status line under mic
    const [log, setLog] = useState([])
    const [tel, setTel] = useState(DEFAULT_TEL)
    const [backendOk, setBackendOk] = useState(null)
    const [liveMode, setLiveMode] = useState(false)
    const logRef = useRef()
    const esSrcRef = useRef(null)

    // ── 1. Detect backend & connect SSE ───────────────────────────────
    useEffect(() => {
        // Quick connectivity probe
        fetch(`${BACKEND}/telemetry`, { signal: AbortSignal.timeout(2500) })
            .then(r => r.json())
            .then(data => {
                setBackendOk(true)
                if (data.connected) {
                    setLiveMode(true)
                    connectSSE()
                }
            })
            .catch(() => setBackendOk(false))

        return () => { if (esSrcRef.current) esSrcRef.current.close() }
    }, [])

    // ── 2. Server-Sent Events – 2 Hz real drone data ──────────────────
    const connectSSE = useCallback(() => {
        if (esSrcRef.current) esSrcRef.current.close()
        const es = new EventSource(`${BACKEND}/telemetry/stream`)
        esSrcRef.current = es

        es.onmessage = (e) => {
            try {
                const d = JSON.parse(e.data)
                if (!d || !d.connected) return
                setTel(prev => ({
                    ...prev,
                    altitude: d.altitude ?? prev.altitude,
                    groundspeed: d.groundspeed ?? prev.groundspeed,
                    airspeed: d.airspeed ?? prev.airspeed,
                    battPct: d.battery_pct != null ? d.battery_pct : prev.battPct,
                    battVolt: d.battery_volt ?? prev.battVolt,
                    lat: d.lat ?? prev.lat,
                    lon: d.lon ?? prev.lon,
                    mode: d.mode ?? prev.mode,
                    heading: d.heading ?? prev.heading,
                    roll: d.roll ?? prev.roll,
                    pitch: d.pitch ?? prev.pitch,
                    armed: d.armed ?? prev.armed,
                    satellites: d.satellites ?? prev.satellites,
                    gps_fix: d.gps_fix ?? prev.gps_fix,
                }))
            } catch { /* ignore parse errors */ }
        }

        es.onerror = () => {
            es.close()
            // Retry after 3 s
            setTimeout(connectSSE, 3000)
        }
    }, [])

    // ── Auto-scroll log ───────────────────────────────────────────────
    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    }, [log])

    const addLog = (msg, type = 'info') => {
        const ts = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        setLog(l => [...l.slice(-29), { msg, type, ts }])
    }

    // ── Send command to backend ───────────────────────────────────────
    const executeCmd = async (text, intent, value) => {
        addLog(`> "${text}"`, 'cmd')

        if (!backendOk || !liveMode) {
            alert("⚠️ Connection Pending\n\nPlease ensure the VoiceControlDrone server is running, and connect SITL, QGroundControl, and all other connections to execute commands.")
            addLog('Command rejected: Connection is pending', 'warn')
            return
        }

        try {
            const res = await fetch(`${BACKEND}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            })
            const data = await res.json()
            addLog(`intent=${data.intent}  value=${data.value}  status=${data.status}`, 'ok')
        } catch {
            alert("⚠️ Connection Pending\n\nPlease ensure the VoiceControlDrone server is running, and connect SITL, QGroundControl, and all other connections to execute commands.")
            addLog('Backend unreachable', 'warn')
        }
    }



    const handleSend = () => {
        if (!inputText.trim()) return
        executeCmd(inputText, 'UNKNOWN', null)
        setInputText('')
    }

    // ── speech processing state ──────────────────────────────────────
    const shouldListenRef = useRef(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const tickerRef = useRef(null);
    const srRef = useRef(null); // For Web Speech API ref

    const stopListening = () => {
        shouldListenRef.current = false;
        setMicActive(false);
        setRecProgress(0);
        setSttLabel('🛑 System Stopped.');
        clearInterval(tickerRef.current);

        if (sttMode === 'whisper') {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            }
        } else if (srRef.current) {
            try { srRef.current.stop(); } catch (e) { }
        }
    };

    const processWhisperAudio = async (blob) => {
        if (blob.size === 0) return;
        const form = new FormData()
        form.append('audio', blob, 'cmd.webm')

        try {
            setSttLabel("⏳ Transcribing (Whisper)...");
            const res = await fetch(`${BACKEND}/stt`, { method: 'POST', body: form })
            const data = await res.json()

            if ((data.status === 'ok') && data.text) {
                const text = data.text.trim();
                setInputText(text)
                setSttLabel(`✅ Whisper: "${text}"`)
                addLog(`Whisper: "${text}"`, 'ok')
                await executeCmd(text, 'UNKNOWN', null)
            } else if (data.status === 'empty') {
                // Ignore silence
                setSttLabel(`🎧 Listening...`)
            } else {
                setSttLabel(`⚠️ STT Error: ${data.detail || 'Unknown'}`)
            }
        } catch {
            setSttLabel(`⚠️ Backend unreachable. Is server.py running?`)
        }
    };

    const startRecordingCycle = () => {
        if (!shouldListenRef.current || !mediaRecorderRef.current) return;
        audioChunksRef.current = [];

        try {
            mediaRecorderRef.current.start();
            setSttLabel('🎧 Listening... (Speak now)');

            // Manage progress bar
            setRecProgress(0);
            const REC_MS = 5000;
            const TICK_MS = 80;
            let elapsed = 0;
            tickerRef.current = setInterval(() => {
                elapsed += TICK_MS;
                setRecProgress(Math.min(100, (elapsed / REC_MS) * 100));
            }, TICK_MS);

            setTimeout(() => {
                clearInterval(tickerRef.current);
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                    mediaRecorderRef.current.stop();
                }
            }, REC_MS);
        } catch (e) { console.error(e) }
    };

    const startOfflineListening = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            addLog('⚠️ getUserMedia not available — use HTTPS or localhost', 'warn')
            return
        }
        setMicActive(true);
        shouldListenRef.current = true;
        setSttLabel('🎧 Initialize...');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }

            recorder.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })

                // Process audio asynchronously
                processWhisperAudio(blob);

                // Start next cycle if still listening
                if (shouldListenRef.current) {
                    setTimeout(startRecordingCycle, 200);
                } else {
                    stream.getTracks().forEach(t => t.stop());
                }
            };

            startRecordingCycle();
        } catch {
            addLog('🚫 Microphone access denied', 'warn')
            setMicActive(false); setSttLabel('')
        }
    }

    const handleMic = async () => {
        if (micActive) {
            stopListening();
            return;
        }

        if (sttMode === 'whisper') {
            await startOfflineListening();
            return;
        }

        // 🌐 Online — browser Web Speech API (requires internet)
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            addLog('⚠️ Web Speech API not supported in this browser', 'warn')
            return
        }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        const r = new SR()
        srRef.current = r;
        r.lang = 'en-US'
        r.continuous = true
        r.interimResults = false

        setMicActive(true)
        shouldListenRef.current = true;
        setSttLabel('Listening via Web Speech API…')

        r.onresult = e => {
            const text = e.results[e.results.length - 1][0].transcript.trim()
            if (!text) return;
            setInputText(text)
            setSttLabel(`🌐 Heard: "${text}"`)
            addLog(`🌐 Web Speech: "${text}"`, 'ok')
            executeCmd(text, 'UNKNOWN', null)
            setTimeout(() => { if (shouldListenRef.current) setSttLabel('Listening via Web Speech API…') }, 3000)
        }
        r.onend = () => {
            if (shouldListenRef.current) {
                try { r.start(); } catch (e) { }
            } else {
                setMicActive(false); setSttLabel('🛑 System Stopped.');
            }
        }
        r.onerror = (e) => {
            console.error(e);
            if (e.error !== 'no-speech') {
                setMicActive(false); setSttLabel('⚠️ Web Speech Error');
                shouldListenRef.current = false;
            }
        }
        try { r.start(); } catch (e) { console.error(e) }
    }

    // ── Derived values ────────────────────────────────────────────────
    const displaySpeed = liveMode ? tel.groundspeed : tel.groundspeed
    const displayBatt = tel.battPct ?? 87
    const gpsFixed = tel.gps_fix >= 3
    const modeColor = MODE_COLORS[tel.mode] || '#475569'

    return (
        <section id="demo" className="section" style={{ zIndex: 1, background: 'linear-gradient(180deg, transparent, rgba(5,13,30,0.95) 15%, rgba(5,13,30,0.95) 85%, transparent)' }}>
            <div className="container">
                <div className="section-label">🎮 Live Demo</div>
                <h2 className="section-title">Ground Control Station</h2>

                {/* ── Status bar ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Backend:
                        <span style={{ fontWeight: 700, color: backendOk ? '#10b981' : backendOk === false ? '#ef4444' : '#f59e0b' }}>
                            {backendOk === null ? '⏳ Checking…' : backendOk ? '✅ localhost:8002' : '🟡 Offline'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Telemetry:
                        <span style={{ fontWeight: 700, color: liveMode ? '#00e5ff' : '#f59e0b' }}>
                            {liveMode ? '📡 LIVE — SSE stream active' : '🟡 Simulation mode'}
                        </span>
                    </div>
                    {tel.armed && (
                        <span style={{ padding: '3px 12px', borderRadius: 50, fontSize: '0.78rem', fontWeight: 700, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}>
                            ⚠️ ARMED
                        </span>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>

                    {/* ── LEFT: Voice input + Quick commands + Log ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {/* Voice input row */}
                        <div className="glass" style={{ borderRadius: 16, padding: '18px 20px' }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: recProgress > 0 ? 10 : 0 }}>
                                {/* Mic button */}
                                <button onClick={handleMic} style={{
                                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                    background: micActive ? 'rgba(239,68,68,0.2)' : sttMode === 'offline' ? 'rgba(167,139,250,0.12)' : 'rgba(0,229,255,0.1)',
                                    border: `2px solid ${micActive ? '#ef4444' : sttMode === 'offline' ? '#a78bfa' : '#00e5ff'}`,
                                    fontSize: '1.2rem', cursor: 'pointer',
                                    animation: micActive ? 'glow-pulse 1s infinite' : 'none',
                                    transition: 'all 0.2s',
                                }}>
                                    {micActive ? '🔴' : '🎙️'}
                                </button>
                                <input
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder="Type or speak a command…"
                                    style={{
                                        flex: 1, background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(0,229,255,0.15)', borderRadius: 10,
                                        padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: '0.88rem',
                                        color: 'var(--text-primary)', outline: 'none',
                                    }}
                                />
                                <button onClick={handleSend} className="btn btn-primary" style={{ padding: '10px 18px', fontSize: '0.82rem', flexShrink: 0 }}>
                                    Send ↑
                                </button>
                            </div>

                            {/* STT mode toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>STT:</span>
                                {[
                                    { id: 'whisper', label: '🎙️ Whisper (offline)', color: '#a78bfa' },
                                    { id: 'online', label: '🌐 Web Speech (online)', color: '#f59e0b' },
                                ].map(m => (
                                    <button key={m.id} onClick={() => setSttMode(m.id)} style={{
                                        padding: '3px 11px', borderRadius: 50, fontSize: '0.67rem', fontWeight: 700,
                                        cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.2s',
                                        background: sttMode === m.id ? `${m.color}22` : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${sttMode === m.id ? m.color : 'rgba(255,255,255,0.08)'}`,
                                        color: sttMode === m.id ? m.color : 'var(--text-muted)',
                                    }}>{m.label}</button>
                                ))}
                            </div>

                            {/* sttLabel status + recording progress bar */}
                            {sttLabel && (
                                <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)', padding: '4px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6 }}>
                                    {sttLabel}
                                </div>
                            )}
                            {recProgress > 0 && (
                                <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 4,
                                        width: `${recProgress}%`,
                                        background: 'linear-gradient(90deg, #a78bfa, #7c3aed)',
                                        boxShadow: '0 0 8px #a78bfa66',
                                        transition: 'width 0.08s linear',
                                    }} />
                                </div>
                            )}
                        </div>

                        {/* Quick commands */}
                        <div className="glass" style={{ borderRadius: 16, padding: 18 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
                                Quick Commands
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                {DEMO_COMMANDS.map(c => (
                                    <button key={c.cmd}
                                        onClick={() => { setInputText(c.cmd); executeCmd(c.cmd, c.intent, c.value) }}
                                        style={{
                                            background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.12)',
                                            borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
                                            fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font)',
                                            fontWeight: 600, transition: 'all 0.2s', textAlign: 'center',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.15)'; e.currentTarget.style.color = '#00e5ff' }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.06)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                                    >{c.cmd}</button>
                                ))}
                            </div>
                        </div>

                        {/* Command log */}
                        <div className="glass" style={{ borderRadius: 16, overflow: 'hidden' }}>
                            <div style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(0,229,255,0.08)', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                                📋 GCS Command Log
                            </div>
                            <div ref={logRef} style={{ padding: 14, maxHeight: 220, overflowY: 'auto', fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>
                                {log.length === 0
                                    ? <span style={{ color: 'var(--text-muted)' }}>Awaiting first command…</span>
                                    : log.map((l, i) => (
                                        <div key={i} style={{ padding: '3px 0', color: l.type === 'cmd' ? '#00e5ff' : l.type === 'ok' ? '#10b981' : l.type === 'warn' ? '#f59e0b' : 'var(--text-secondary)' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>[{l.ts}] </span>{l.msg}
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT: Telemetry HUD ── */}
                    <div className="glass" style={{ borderRadius: 18, overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{
                            padding: '14px 20px', background: 'rgba(0,0,0,0.4)',
                            borderBottom: '1px solid rgba(0,229,255,0.1)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                                📡 Telemetry HUD
                                {liveMode && <span style={{ fontSize: '0.68rem', color: '#00e5ff', marginLeft: 8, fontWeight: 600 }}>● LIVE</span>}
                            </span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {/* Heading badge */}
                                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                                    HDG {tel.heading}°
                                </span>
                                {/* Mode badge */}
                                <span style={{
                                    fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                                    background: `${modeColor}22`, border: `1px solid ${modeColor}44`, color: modeColor,
                                }}>● {tel.mode}</span>
                            </div>
                        </div>

                        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Big value cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
                                {[
                                    { label: 'Altitude', val: tel.altitude, unit: ' m', color: '#00e5ff' },
                                    { label: 'Groundspeed', val: displaySpeed.toFixed(1), unit: ' m/s', color: '#10b981' },
                                ].map(v => (
                                    <div key={v.label} style={{
                                        padding: '18px', borderRadius: 14,
                                        background: `radial-gradient(circle at 30% 30%, ${v.color}12, transparent)`,
                                        border: `1px solid ${v.color}30`, textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '2.2rem', fontWeight: 900, color: v.color, fontFamily: 'var(--mono)', lineHeight: 1 }}>
                                            {v.val}
                                            <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>{v.unit}</span>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                            {v.label} {liveMode ? <span style={{ color: '#00e5ff' }}>●</span> : ''}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Gauges */}
                            <Gauge label="Battery" value={displayBatt.toFixed(0)} max={100} unit="%" color="#f59e0b" />
                            <Gauge label="Altitude" value={tel.altitude} max={50} unit=" m" color="#00e5ff" />
                            <Gauge label="Groundspeed" value={displaySpeed} max={15} unit=" m/s" color="#10b981" />
                            <Gauge label="Airspeed" value={tel.airspeed} max={15} unit=" m/s" color="#a78bfa" />

                            {/* Attitude row (roll / pitch) – only shown when live */}
                            {liveMode && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {[
                                        { label: 'Roll', v: tel.roll, color: '#f59e0b' },
                                        { label: 'Pitch', v: tel.pitch, color: '#a78bfa' },
                                    ].map(a => (
                                        <div key={a.label} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                            <div style={{ fontFamily: 'var(--mono)', fontSize: '1.1rem', fontWeight: 800, color: a.color }}>{a.v}°</div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{a.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* GPS / battery voltage row */}
                            <div style={{ display: 'grid', gridTemplateColumns: tel.battVolt ? '1fr 1fr' : '1fr', gap: 10 }}>
                                {/* GPS */}
                                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <span style={{ color: gpsFixed ? '#10b981' : '#f59e0b', marginRight: 6 }}>
                                        {gpsFixed ? '📍 GPS LOCK' : '⚠️ GPS SEARCH'}
                                    </span>
                                    {tel.lat != null && (
                                        <><br />{tel.lat.toFixed(5)} {tel.lon.toFixed(5)}</>
                                    )}
                                    {liveMode && <span style={{ color: 'var(--text-muted)' }}> · {tel.satellites} sats</span>}
                                </div>
                                {/* Battery voltage (live only) */}
                                {tel.battVolt && (
                                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>{tel.battVolt} V</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Batt Voltage</div>
                                    </div>
                                )}
                            </div>

                            {/* Scan-line shimmer */}
                            <div style={{ position: 'relative', height: 2, overflow: 'hidden', marginTop: 2 }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
                                    background: 'linear-gradient(90deg, transparent, #00e5ff55, transparent)',
                                    animation: 'scan-line 3s linear infinite',
                                }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        @media (max-width: 768px) {
          #demo .container > div { grid-template-columns: 1fr !important; }
        }
      `}</style>
        </section>
    )
}
