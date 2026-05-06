import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const NODES = [
    { id: 'user', label: '👤 User', sub: 'Speaks a command', color: '#f59e0b' },
    { id: 'browser', label: '🌐 Browser UI', sub: 'Whisper (Offline) / Web Speech → text', color: '#00e5ff' },
    { id: 'server', label: '⚡ FastAPI Server', sub: 'POST /command orchestration', color: '#10b981' },
    { id: 'nlp', label: '🧠 spaCy NLP', sub: 'Intent + parameter extraction', color: '#a78bfa' },
    { id: 'drone', label: '🚁 Drone (MAVLink)', sub: 'DroneKit executes flight cmd', color: '#ef4444' },
]

const FLOW = [
    { from: 0, to: 1, label: 'Speaks "Take off 10m"' },
    { from: 1, to: 2, label: 'POST /command {text}' },
    { from: 2, to: 3, label: 'parse(text)' },
    { from: 3, to: 2, label: '("TAKEOFF", 10)', reverse: true },
    { from: 2, to: 4, label: 'execute(TAKEOFF, 10)' },
]

export default function ArchitectureSection() {
    const [visible, setVisible] = useState(false)
    const [active, setActive] = useState(-1)
    const sectionRef = useRef()

    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) setVisible(true)
        }, { threshold: 0.15 })
        obs.observe(sectionRef.current)
        return () => obs.disconnect()
    }, [])

    // Animate nodes sequentially
    useEffect(() => {
        if (!visible) return
        let i = -1
        const id = setInterval(() => {
            i++
            setActive(i)
            if (i >= NODES.length - 1) clearInterval(id)
        }, 380)
        return () => clearInterval(id)
    }, [visible])

    return (
        <section id="architecture" className="section" ref={sectionRef} style={{ zIndex: 1, background: 'linear-gradient(180deg, transparent, rgba(5,13,30,0.9) 20%, rgba(5,13,30,0.9) 80%, transparent)' }}>
            <div className="container">
                <div className="section-label">🏗️ System Architecture</div>
                <h2 className="section-title">How It All Connects</h2>
                <p className="section-desc">
                    Five modular layers work in harmony inside our Dockerized environment — from your spoken word through NLP parsing to MAVLink drone control. Every component is decoupled for reliability and testability.
                </p>

                {/* Flow diagram */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0',
                    maxWidth: 720,
                    margin: '0 auto',
                    position: 'relative',
                }}>
                    {NODES.map((node, i) => (
                        <div key={node.id}>
                            {/* Node card */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 20,
                                opacity: active >= i ? 1 : 0,
                                transform: active >= i ? 'none' : 'translateY(20px)',
                                transition: 'all 0.5s ease',
                            }}>
                                {/* Index + line */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: '50%',
                                        background: `linear-gradient(135deg, ${node.color}33, ${node.color}11)`,
                                        border: `2px solid ${node.color}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 800, fontSize: '0.9rem', color: node.color,
                                        boxShadow: active >= i ? `0 0 18px ${node.color}55` : 'none',
                                        transition: 'box-shadow 0.4s',
                                    }}>{i + 1}</div>
                                </div>

                                {/* Card */}
                                <div className="glass" style={{
                                    flex: 1, padding: '18px 24px', borderRadius: 14,
                                    borderColor: active >= i ? `${node.color}44` : 'var(--border)',
                                    transition: 'border-color 0.4s, box-shadow 0.4s',
                                    boxShadow: active >= i ? `0 0 20px ${node.color}22` : 'none',
                                }}>
                                    <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>{node.label}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{node.sub}</div>
                                </div>
                            </div>

                            {/* Connector arrow */}
                            {i < NODES.length - 1 && (
                                <div style={{
                                    marginLeft: 22,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    padding: '6px 0',
                                    opacity: active >= i ? 1 : 0,
                                    transition: 'opacity 0.5s 0.3s',
                                }}>
                                    <div style={{
                                        width: 2, height: 16,
                                        background: `linear-gradient(${NODES[i].color}, ${NODES[i + 1].color})`,
                                    }} />
                                    <div style={{
                                        fontSize: '0.72rem', fontFamily: 'var(--mono)',
                                        color: NODES[i].color, padding: '2px 10px',
                                        background: `${NODES[i].color}15`, borderRadius: 6,
                                        border: `1px solid ${NODES[i].color}33`,
                                        margin: '3px 0',
                                    }}>
                                        {FLOW[i]?.label}
                                    </div>
                                    <div style={{
                                        width: 2, height: 16,
                                        background: `linear-gradient(${NODES[i].color}, ${NODES[i + 1].color})`,
                                    }} />
                                    <div style={{
                                        width: 0, height: 0,
                                        borderLeft: '5px solid transparent',
                                        borderRight: '5px solid transparent',
                                        borderTop: `8px solid ${NODES[i + 1].color}`,
                                    }} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* ── Redesigned feature deep-dive cards ── */}
                <FeatureCards />
            </div>
        </section>
    )
}

/* ──────────────────────────────────────────────
   Feature Deep-Dive Cards
   ────────────────────────────────────────────── */
const FEATURES = [
    {
        icon: '🔇',
        title: 'Offline First',
        tagline: 'Zero cloud dependency',
        desc: 'The entire NLP pipeline runs on-device using spaCy\'s small English model. No internet required — ideal for RF-contested or air-gapped environments.',
        tags: ['spaCy', 'en_core_web_sm', 'NLP'],
        color: '#00e5ff',
        href: '/topic/offline-first',
    },
    {
        icon: '🔄',
        title: 'Async Architecture',
        tagline: 'FastAPI + ThreadPool',
        desc: 'run_in_threadpool() offloads blocking DroneKit calls to worker threads, keeping the async event loop fully responsive for concurrent connections and SSE streaming.',
        tags: ['FastAPI', 'asyncio', 'run_in_threadpool'],
        color: '#10b981',
        href: '/topic/async-architecture',
    },
    {
        icon: '🔗',
        title: 'MAVLink Protocol',
        tagline: 'Industry-standard UAV comms',
        desc: 'Voice intents are serialized into SET_POSITION_TARGET_LOCAL_NED and COMMAND_LONG MAVLink messages via DroneKit, forwarded over UDP to the ArduPilot autopilot.',
        tags: ['MAVLink', 'DroneKit', 'pymavlink'],
        color: '#a78bfa',
        href: '/topic/mavlink-protocol',
    },
    {
        icon: '🧪',
        title: 'SITL Ready',
        tagline: 'Zero-hardware testing',
        desc: 'Plug VoiceControlDrone into ArduPilot SITL and fly in a full physics simulation. Run QGroundControl alongside via MAVProxy port forwarding.',
        tags: ['ArduPilot', 'SITL', 'QGroundControl'],
        color: '#f59e0b',
        href: '/topic/sitl-ready',
    },
]

function FeatureCards() {
    const navigate = useNavigate()
    const [hovered, setHovered] = useState(null)

    return (
        <div style={{ marginTop: 64 }}>
            {/* Section sub-heading */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                    Technical Deep Dives
                </div>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    Explore the Architecture Pillars
                </h3>
                <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 520 }}>
                    Click any card to read the full technical explanation, code examples, and design rationale behind each system layer.
                </p>
            </div>

            {/* Card grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 20,
            }}>
                {FEATURES.map((f, i) => (
                    <button
                        key={f.href}
                        onClick={() => navigate(f.href)}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                            background: 'var(--bg-card)',
                            border: `1px solid ${hovered === i ? f.color : 'rgba(255,255,255,0.06)'}`,
                            borderRadius: 20,
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'var(--font)',
                            overflow: 'hidden',
                            backdropFilter: 'blur(18px)',
                            transform: hovered === i ? 'translateY(-6px)' : 'none',
                            boxShadow: hovered === i ? `0 12px 40px ${f.color}22, 0 0 0 1px ${f.color}33` : '0 2px 12px rgba(0,0,0,0.3)',
                            transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                            animation: `fade-up 0.5s ${i * 90}ms ease both`,
                        }}
                    >
                        {/* Gradient header banner */}
                        <div style={{
                            height: 90,
                            background: `linear-gradient(135deg, ${f.color}20 0%, ${f.color}06 60%, transparent 100%)`,
                            borderBottom: `1px solid ${f.color}20`,
                            display: 'flex', alignItems: 'center', padding: '0 24px',
                            position: 'relative', overflow: 'hidden',
                        }}>
                            {/* Big background icon watermark */}
                            <span style={{
                                position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                                fontSize: '4rem', opacity: 0.12, userSelect: 'none',
                                filter: `drop-shadow(0 0 12px ${f.color})`,
                            }}>{f.icon}</span>
                            {/* Foreground icon */}
                            <div style={{
                                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                                background: `${f.color}18`, border: `1px solid ${f.color}44`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.6rem',
                                boxShadow: hovered === i ? `0 0 20px ${f.color}44` : 'none',
                                transition: 'box-shadow 0.3s',
                            }}>{f.icon}</div>
                        </div>

                        {/* Card body */}
                        <div style={{ padding: '20px 24px 22px' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                                {f.title}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: f.color, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {f.tagline}
                            </div>

                            <p style={{
                                fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 18,
                                minHeight: 70,
                            }}>
                                {f.desc}
                            </p>

                            {/* Tags */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                                {f.tags.map(tag => (
                                    <span key={tag} style={{
                                        fontSize: '0.68rem', fontWeight: 700, fontFamily: 'var(--mono)',
                                        padding: '3px 8px', borderRadius: 6,
                                        background: `${f.color}12`, border: `1px solid ${f.color}28`,
                                        color: f.color,
                                    }}>{tag}</span>
                                ))}
                            </div>

                            {/* CTA */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                paddingTop: 14, borderTop: `1px solid ${f.color}18`,
                            }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: f.color }}>
                                    Explore deep dive
                                </span>
                                <span style={{
                                    fontSize: '1rem', color: f.color,
                                    transform: hovered === i ? 'translateX(4px)' : 'none',
                                    transition: 'transform 0.2s',
                                }}>→</span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <style>{`
        @media (max-width: 768px) {
          .feature-cards { grid-template-columns: 1fr !important; }
        }
      `}</style>
        </div>
    )
}
