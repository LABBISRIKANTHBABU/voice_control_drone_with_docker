import { useState, useRef, useEffect } from 'react'

const COMMAND_GROUPS = [
    {
        group: '🛫 Basic Actions',
        color: '#00e5ff',
        commands: [
            { cmd: 'Take off 10 meters', intent: 'TAKEOFF', value: 10 },
            { cmd: 'Land now', intent: 'LAND', value: null },
            { cmd: 'Return to Home', intent: 'RTL', value: null },
            { cmd: 'Arm the drone', intent: 'ARM', value: null },
            { cmd: 'Disarm', intent: 'DISARM', value: null },
        ],
    },
    {
        group: '↔️ Movement',
        color: '#10b981',
        commands: [
            { cmd: 'Move forward 5 meters', intent: 'MOVE_FORWARD', value: 5 },
            { cmd: 'Move backward 5', intent: 'MOVE_BACKWARD', value: 5 },
            { cmd: 'Move left 5 meters', intent: 'MOVE_LEFT', value: 5 },
            { cmd: 'Move right 5 meters', intent: 'MOVE_RIGHT', value: 5 },
            { cmd: 'Ascend 2 meters', intent: 'MOVE_UP', value: 2 },
            { cmd: 'Descend 2 meters', intent: 'MOVE_DOWN', value: 2 },
        ],
    },
    {
        group: '🔄 Orientation',
        color: '#a78bfa',
        commands: [
            { cmd: 'Rotate right 90 degrees', intent: 'ROTATE_CW', value: 90 },
            { cmd: 'Turn left 45 degrees', intent: 'ROTATE_CCW', value: 45 },
        ],
    },
    {
        group: '🛑 Safety',
        color: '#ef4444',
        commands: [
            { cmd: 'Hold position', intent: 'HOLD', value: null },
        ],
    },
]

export default function CommandsSection() {
    const [result, setResult] = useState(null)
    const [micActive, setMicActive] = useState(false)
    const [inputText, setInputText] = useState('')
    const [visible, setVisible] = useState(false)
    const sectionRef = useRef()
    const inputRef = useRef()

    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
        obs.observe(sectionRef.current)
        return () => obs.disconnect()
    }, [])

    const fire = (cmd) => {
        setResult({ ...cmd, ts: Date.now() })
    }

    const handleMic = () => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            // Simulate
            setMicActive(true)
            setTimeout(() => {
                setMicActive(false)
                fire({ cmd: 'Take off 10 meters', intent: 'TAKEOFF', value: 10 })
            }, 2500)
            return
        }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        const r = new SR()
        r.lang = 'en-US'
        r.interimResults = false
        setMicActive(true)
        r.onresult = (e) => {
            const text = e.results[0][0].transcript
            setInputText(text)
            // simple local parse
            const t = text.toLowerCase()
            let intent = 'UNKNOWN', value = null
            if (t.includes('take off') || t.includes('takeoff')) { intent = 'TAKEOFF'; value = parseInt(t.match(/\d+/)?.[0]) || 10 }
            else if (t.includes('land')) { intent = 'LAND' }
            else if (t.includes('return') || t.includes('rtl')) { intent = 'RTL' }
            else if (t.includes('forward')) { intent = 'MOVE_FORWARD'; value = parseInt(t.match(/\d+/)?.[0]) || 5 }
            else if (t.includes('backward') || t.includes('back')) { intent = 'MOVE_BACKWARD'; value = parseInt(t.match(/\d+/)?.[0]) || 5 }
            else if (t.includes('left') && !t.includes('rotate')) { intent = 'MOVE_LEFT'; value = parseInt(t.match(/\d+/)?.[0]) || 5 }
            else if (t.includes('right') && !t.includes('rotate')) { intent = 'MOVE_RIGHT'; value = parseInt(t.match(/\d+/)?.[0]) || 5 }
            else if (t.includes('up') || t.includes('ascend')) { intent = 'MOVE_UP'; value = parseInt(t.match(/\d+/)?.[0]) || 2 }
            else if (t.includes('down') || t.includes('descend')) { intent = 'MOVE_DOWN'; value = parseInt(t.match(/\d+/)?.[0]) || 2 }
            else if (t.includes('rotate right') || t.includes('turn right')) { intent = 'ROTATE_CW'; value = parseInt(t.match(/\d+/)?.[0]) || 30 }
            else if (t.includes('rotate left') || t.includes('turn left')) { intent = 'ROTATE_CCW'; value = parseInt(t.match(/\d+/)?.[0]) || 30 }
            else if (t.includes('hold') || t.includes('hover') || t.includes('stop')) { intent = 'HOLD' }
            else if (t.includes('arm')) { intent = 'ARM' }
            else if (t.includes('disarm')) { intent = 'DISARM' }
            fire({ cmd: text, intent, value })
        }
        r.onerror = () => setMicActive(false)
        r.onend = () => setMicActive(false)
        r.start()
    }

    const INTENT_COLORS = {
        TAKEOFF: '#00e5ff', LAND: '#10b981', RTL: '#f59e0b', ARM: '#a78bfa', DISARM: '#ef4444',
        MOVE_FORWARD: '#10b981', MOVE_BACKWARD: '#10b981', MOVE_LEFT: '#10b981',
        MOVE_RIGHT: '#10b981', MOVE_UP: '#10b981', MOVE_DOWN: '#10b981',
        ROTATE_CW: '#a78bfa', ROTATE_CCW: '#a78bfa', HOLD: '#ef4444', UNKNOWN: '#475569',
    }

    return (
        <section id="commands" className="section" ref={sectionRef} style={{ zIndex: 1 }}>
            <div className="container">
                <div className="section-label">🗣️ Voice Commands</div>
                <h2 className="section-title">Speak. Parse. Fly.</h2>
                <p className="section-desc">
                    Click any command to see the NLP parse result, or use the live mic to speak your own command. (Tip: If you omit numbers, smart defaults apply, e.g., Takeoff = 10m).
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
                    {/* Command list terminal */}
                    <div className="glass" style={{
                        borderRadius: 18, overflow: 'hidden',
                        animation: visible ? 'slide-in-left 0.6s ease both' : 'none',
                    }}>
                        {/* Terminal header */}
                        <div style={{
                            padding: '12px 18px', background: 'rgba(0,0,0,0.3)',
                            borderBottom: '1px solid rgba(0,229,255,0.1)',
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
                            <span style={{ marginLeft: 10, fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                drone-commands.md
                            </span>
                        </div>
                        {/* Commands */}
                        <div style={{ padding: 18, maxHeight: 480, overflowY: 'auto' }}>
                            {COMMAND_GROUPS.map(g => (
                                <div key={g.group} style={{ marginBottom: 22 }}>
                                    <div style={{
                                        fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em',
                                        textTransform: 'uppercase', color: g.color, marginBottom: 10,
                                    }}>{g.group}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {g.commands.map(c => (
                                            <button
                                                key={c.cmd}
                                                onClick={() => fire(c)}
                                                style={{
                                                    background: result?.cmd === c.cmd ? `${g.color}22` : 'rgba(255,255,255,0.03)',
                                                    border: `1px solid ${result?.cmd === c.cmd ? g.color : 'rgba(255,255,255,0.06)'}`,
                                                    borderRadius: 8, padding: '9px 14px',
                                                    textAlign: 'left', cursor: 'pointer',
                                                    fontFamily: 'var(--mono)', fontSize: '0.83rem',
                                                    color: result?.cmd === c.cmd ? g.color : 'var(--text-secondary)',
                                                    transition: 'all 0.2s',
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                }}
                                            >
                                                <span style={{ color: g.color, opacity: 0.5 }}>$</span>
                                                "{c.cmd}"
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: NLP response + mic */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: 20,
                        animation: visible ? 'slide-in-right 0.6s ease both' : 'none',
                    }}>
                        {/* Mic panel */}
                        <div className="glass" style={{ borderRadius: 18, padding: 28, textAlign: 'center' }}>
                            <div style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Try the live microphone
                            </div>

                            {/* Mic button */}
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <button
                                    onClick={handleMic}
                                    style={{
                                        width: 80, height: 80, borderRadius: '50%',
                                        background: micActive
                                            ? 'radial-gradient(circle, #ef444455, #ef444438)'
                                            : 'radial-gradient(circle, rgba(0,229,255,0.2), rgba(124,58,237,0.1))',
                                        border: `2px solid ${micActive ? '#ef4444' : '#00e5ff'}`,
                                        cursor: 'pointer', fontSize: '2rem',
                                        transition: 'all 0.3s',
                                        boxShadow: micActive
                                            ? '0 0 30px #ef444466'
                                            : '0 0 20px rgba(0,229,255,0.3)',
                                        position: 'relative', zIndex: 1,
                                    }}
                                    aria-label="Activate microphone"
                                >
                                    {micActive ? '🔴' : '🎙️'}
                                </button>
                                {micActive && (
                                    <>
                                        {[0, 1, 2].map(i => (
                                            <div key={i} style={{
                                                position: 'absolute', inset: 0,
                                                borderRadius: '50%',
                                                border: '2px solid #ef4444',
                                                animation: `ripple 1.5s ${i * 0.5}s infinite`,
                                                opacity: 0,
                                            }} />
                                        ))}
                                    </>
                                )}
                            </div>

                            <div style={{ marginTop: 14, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {micActive ? '🎙️ Listening…' : 'Click to speak a command'}
                            </div>

                            {/* Waveform bars */}
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 16, height: 40, alignItems: 'flex-end' }}>
                                {Array.from({ length: 18 }).map((_, i) => (
                                    <div key={i} style={{
                                        width: 4, borderRadius: 4,
                                        background: `hsl(${195 + i * 3},100%,65%)`,
                                        height: micActive ? undefined : 4,
                                        animation: micActive ? `waveform ${0.4 + Math.random() * 0.6}s ${i * 0.04}s infinite alternate ease-in-out` : 'none',
                                        minHeight: 4, transition: 'all 0.2s',
                                    }} />
                                ))}
                            </div>

                            {inputText && (
                                <div style={{
                                    marginTop: 14, padding: '8px 14px',
                                    background: 'rgba(0,229,255,0.06)', borderRadius: 8,
                                    fontFamily: 'var(--mono)', fontSize: '0.83rem', color: '#00e5ff',
                                    textAlign: 'left',
                                }}>
                                    Heard: "{inputText}"
                                </div>
                            )}
                        </div>

                        {/* NLP Result panel */}
                        {result ? (
                            <div key={result.ts} className="glass" style={{
                                borderRadius: 18, padding: 24, overflow: 'hidden',
                                animation: 'fade-up 0.4s ease both',
                                borderColor: `${INTENT_COLORS[result.intent] || '#475569'}55`,
                            }}>
                                <div style={{
                                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em',
                                    textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12,
                                }}>
                                    NLP Parse Result
                                </div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem', lineHeight: 2 }}>
                                    <div><span style={{ color: 'var(--text-muted)' }}>input  </span> <span style={{ color: '#e8f4fd' }}>"{result.cmd}"</span></div>
                                    <div style={{ marginTop: 6 }}>
                                        <span style={{ color: 'var(--text-muted)' }}>intent </span>{' '}
                                        <span style={{
                                            color: INTENT_COLORS[result.intent] || '#475569',
                                            background: `${INTENT_COLORS[result.intent] || '#475569'}18`,
                                            padding: '2px 10px', borderRadius: 6,
                                            fontWeight: 700,
                                        }}>
                                            {result.intent}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>value  </span>{' '}
                                        <span style={{ color: '#f59e0b' }}>
                                            {result.value !== null ? result.value : 'null'}
                                            {result.value ? <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> meters / degrees</span> : ''}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: '0.82rem' }}>
                                        ✅ Command recognized → dispatching to drone_control.execute()
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="glass" style={{
                                borderRadius: 18, padding: 24,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                minHeight: 160, color: 'var(--text-muted)', gap: 10,
                            }}>
                                <span style={{ fontSize: '2rem' }}>🤖</span>
                                <span style={{ fontSize: '0.85rem' }}>Click a command to see the NLP parse result</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
        @media (max-width: 768px) {
          #commands .container > div { grid-template-columns: 1fr !important; }
        }
      `}</style>
        </section>
    )
}
