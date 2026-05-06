import { useEffect, useRef, useState } from 'react'
import DroneCanvas from './DroneScene.jsx'

const PHRASES = [
    '"Take off 10 meters"',
    '"Move forward 5 meters"',
    '"Rotate right 90 degrees"',
    '"Return to Home"',
    '"Land now"',
    '"Hold position"',
]

export default function HeroSection() {
    const [phraseIdx, setPhraseIdx] = useState(0)
    const [displayed, setDisplayed] = useState('')
    const [typing, setTyping] = useState(true)
    const timerRef = useRef()

    // Typewriter effect
    useEffect(() => {
        const phrase = PHRASES[phraseIdx]
        if (typing) {
            if (displayed.length < phrase.length) {
                timerRef.current = setTimeout(() => setDisplayed(phrase.slice(0, displayed.length + 1)), 55)
            } else {
                timerRef.current = setTimeout(() => setTyping(false), 2000)
            }
        } else {
            if (displayed.length > 0) {
                timerRef.current = setTimeout(() => setDisplayed(d => d.slice(0, -1)), 28)
            } else {
                setPhraseIdx(i => (i + 1) % PHRASES.length)
                setTyping(true)
            }
        }
        return () => clearTimeout(timerRef.current)
    }, [displayed, typing, phraseIdx])

    return (
        <section id="hero" style={{
            minHeight: '100vh',
            display: 'flex', alignItems: 'center',
            position: 'relative', overflow: 'hidden',
            paddingTop: '80px',
            zIndex: 1,
        }}>
            {/* Background gradient blobs */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                background: 'radial-gradient(ellipse 60% 70% at 70% 50%, rgba(124,58,237,0.12) 0%, transparent 70%),' +
                    'radial-gradient(ellipse 50% 60% at 20% 60%, rgba(0,229,255,0.07) 0%, transparent 70%)',
            }} />

            <div className="container" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '48px',
                alignItems: 'center',
                position: 'relative', zIndex: 1,
                width: '100%',
            }}>
                {/* LEFT: Text content */}
                <div style={{ animation: 'slide-in-left 0.8s ease both' }}>
                    <div className="section-label" style={{ marginBottom: 20 }}>
                        🚁 AI-Powered Autonomy
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(2.4rem, 6vw, 4rem)',
                        fontWeight: 900,
                        lineHeight: 1.1,
                        background: 'linear-gradient(135deg, #e8f4fd 0%, #00e5ff 50%, #a78bfa 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        marginBottom: 24,
                    }}>
                        Voice Control<br />Drone System
                    </h1>

                    {/* Typewriter command display */}
                    <div className="glass" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 12,
                        padding: '12px 20px', borderRadius: 12, marginBottom: 24,
                        minWidth: '340px', minHeight: '52px',
                    }}>
                        <span style={{ fontSize: '1.2rem' }}>🎙️</span>
                        <span style={{
                            fontFamily: 'var(--mono)',
                            fontSize: '0.95rem',
                            color: '#00e5ff',
                        }}>
                            {displayed}
                            <span style={{ animation: 'blink 0.9s infinite', display: 'inline-block', width: 2, height: '1em', background: '#00e5ff', marginLeft: 2, verticalAlign: 'middle' }} />
                        </span>
                    </div>

                    <p style={{
                        fontSize: '1.1rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.7,
                        marginBottom: 36,
                        maxWidth: 480,
                    }}>
                        Speak naturally. Fly precisely. A production-grade offline voice-controlled
                        autonomous drone system built with <strong style={{ color: '#e8f4fd' }}>Python</strong>,{' '}
                        <strong style={{ color: '#00e5ff' }}>FastAPI</strong>,{' '}
                        <strong style={{ color: '#a78bfa' }}>spaCy NLP</strong> & DroneKit.
                    </p>

                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <a href="#demo" className="btn btn-primary">
                            <span>🎮</span> Live Demo
                        </a>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <a
                                href="https://github.com/LABBISRIKANTHBABU/voice_control_drone_with_docker"
                                target="_blank" rel="noreferrer"
                                className="btn btn-ghost"
                            >
                                <span>🐳</span> View Docker Version (Primary)
                            </a>
                            <a
                                href="https://github.com/LABBISRIKANTHBABU/VoiceControlDrone"
                                target="_blank" rel="noreferrer"
                                className="btn btn-ghost"
                                style={{ opacity: 0.8, fontSize: '0.85rem' }}
                            >
                                <span>📂</span> View Manual Version
                            </a>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div style={{
                        display: 'flex', gap: 32, marginTop: 48,
                        paddingTop: 32, borderTop: '1px solid rgba(0,229,255,0.1)',
                    }}>
                        {[
                            { n: '100%', l: 'Offline NLP' },
                            { n: '14', l: 'Voice Intents' },
                            { n: '< 50ms', l: 'Command Latency' },
                        ].map(s => (
                            <div key={s.l}>
                                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#00e5ff' }}>{s.n}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.l}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: 3D Drone */}
                <div style={{
                    height: '580px',
                    position: 'relative',
                    animation: 'slide-in-right 0.9s ease both',
                }}>
                    <DroneCanvas />
                    {/* Glow beneath */}
                    <div style={{
                        position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                        width: 260, height: 40,
                        background: 'radial-gradient(ellipse, rgba(0,229,255,0.25), transparent 70%)',
                        borderRadius: '50%',
                        animation: 'glow-pulse 2s infinite',
                        pointerEvents: 'none',
                    }} />
                </div>
            </div>

            {/* Scroll indicator */}
            <div style={{
                position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                color: 'var(--text-muted)', fontSize: '0.75rem',
                zIndex: 1,
            }}>
                <span>Scroll to explore</span>
                <div style={{
                    width: 22, height: 36,
                    border: '2px solid rgba(0,229,255,0.3)',
                    borderRadius: 12,
                    position: 'relative', overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
                        width: 4, height: 8, background: '#00e5ff', borderRadius: 2,
                        animation: 'fade-up 1.5s infinite',
                    }} />
                </div>
            </div>

            <style>{`
        @media (max-width: 768px) {
          #hero .container { grid-template-columns: 1fr !important; }
          #hero .container > div:last-child { height: 320px !important; }
        }
      `}</style>
        </section>
    )
}
