import { useRef, useState, useEffect } from 'react'

const TEAM = [
    {
        name: 'K. Raghavendra',
        role: 'Project Lead & Full Stack Developer',
        roll: '229X1A05K4',          // ← replace
        college: 'G PULLA REDDY ENGINEERING COLLEGE',          // ← replace
        avatar: '/avatar_raghavendra.png',
        accent: '#00e5ff',
        contrib: ['Voice NLP Pipeline', 'FastAPI Backend', 'Docker'],
        github: '',
        linkedin: '',
    },
    {
        name: 'L. Srikanth Babu',
        role: 'Drone Systems & MAVLink Engineer',
        roll: '229X1A05H9',          // ← replace
        college: 'G PULLA REDDY ENGINEERING COLLEGE',          // ← replace
        avatar: '/avatar_sreekanth.png',
        accent: '#a78bfa',
        contrib: ['DroneKit Integration', 'MAVLink Protocol', 'SITL Testing', 'React Showcase'],
        github: 'https://github.com/LABBISRIKANTHBABU',
        linkedin: '',
    },
    {
        name: 'V. Chandini',
        role: 'Systems Design & Hardware Integration',
        roll: '229X1A05F7',          // ← replace
        college: 'G PULLA REDDY ENGINEERING COLLEGE',          // ← replace
        avatar: '/avatar_chandra.png',
        accent: '#f59e0b',
        contrib: ['System Design', 'Architecture Design', 'Documentation'],
        github: '',
        linkedin: '',
    },
]

export default function TeamSection() {
    const sectionRef = useRef()
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) setVisible(true) },
            { threshold: 0.1 }
        )
        obs.observe(sectionRef.current)
        return () => obs.disconnect()
    }, [])

    return (
        <section
            id="team"
            ref={sectionRef}
            className="section"
            style={{
                zIndex: 1,
                background: 'linear-gradient(180deg, transparent, rgba(5,13,30,0.97) 15%, rgba(5,13,30,0.97) 85%, transparent)',
            }}
        >
            <div className="container">
                {/* ── Section header ── */}
                <div className="section-label">👥 The Builders</div>
                <h2 className="section-title">Meet the Team</h2>
                <p className="section-desc" style={{ maxWidth: 600 }}>
                    Three engineers who built VoiceControlDrone from the ground up — from NLP pipelines
                    and MAVLink stacks to the React showcase you're reading right now.
                </p>

                {/* ── Cards grid ── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 28,
                    marginTop: 52,
                }}>
                    {TEAM.map((m, i) => (
                        <MemberCard key={m.name} member={m} index={i} visible={visible} />
                    ))}
                </div>
            </div>
        </section>
    )
}

function MemberCard({ member: m, index: i, visible }) {
    const [hovered, setHovered] = useState(false)

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                borderRadius: 22,
                overflow: 'hidden',
                background: 'var(--bg-card)',
                border: `1px solid ${hovered ? m.accent : 'rgba(255,255,255,0.07)'}`,
                backdropFilter: 'blur(20px)',
                boxShadow: hovered
                    ? `0 16px 48px ${m.accent}1a, 0 0 0 1px ${m.accent}33, inset 0 1px 0 rgba(255,255,255,0.06)`
                    : '0 4px 24px rgba(0,0,0,0.35)',
                transform: hovered ? 'translateY(-8px)' : visible ? 'translateY(0)' : 'translateY(32px)',
                opacity: visible ? 1 : 0,
                transition: `all 0.45s cubic-bezier(0.34,1.45,0.64,1) ${i * 120}ms`,
            }}
        >
            {/* ── Gradient banner ── */}
            <div style={{
                height: 110,
                background: `linear-gradient(135deg, ${m.accent}28 0%, ${m.accent}08 50%, transparent 100%)`,
                borderBottom: `1px solid ${m.accent}20`,
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-end',
                padding: '0 0 0 24px',
            }}>
                {/* Large watermark letter */}
                <span style={{
                    position: 'absolute', right: 16, top: 8,
                    fontSize: '5rem', fontWeight: 900,
                    color: m.accent, opacity: 0.07, lineHeight: 1,
                    userSelect: 'none',
                    fontFamily: 'var(--font)',
                }}>
                    {m.name[0]}
                </span>

                {/* Avatar image — sits on the border of banner + body */}
                <div style={{
                    width: 88, height: 88,
                    borderRadius: '50%',
                    border: `3px solid ${m.accent}`,
                    overflow: 'hidden',
                    position: 'absolute',
                    bottom: -32,
                    left: 24,
                    boxShadow: `0 0 24px ${m.accent}44, 0 8px 24px rgba(0,0,0,0.5)`,
                    background: 'var(--bg-deep)',
                    transition: 'box-shadow 0.3s',
                    ...(hovered ? { boxShadow: `0 0 36px ${m.accent}77, 0 8px 24px rgba(0,0,0,0.5)` } : {}),
                }}>
                    <img
                        src={m.avatar}
                        alt={m.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => {
                            // Fallback to initials if image fails
                            e.target.style.display = 'none'
                            e.target.parentNode.style.display = 'flex'
                            e.target.parentNode.style.alignItems = 'center'
                            e.target.parentNode.style.justifyContent = 'center'
                            e.target.parentNode.style.fontSize = '2rem'
                            e.target.parentNode.style.fontWeight = '900'
                            e.target.parentNode.style.color = m.accent
                            e.target.parentNode.innerText = m.name[0]
                        }}
                    />
                </div>
            </div>

            {/* ── Card body ── */}
            <div style={{ padding: '44px 24px 24px' }}>
                {/* Name + role */}
                <div style={{ marginBottom: 16 }}>
                    <h3 style={{
                        fontSize: '1.15rem', fontWeight: 800,
                        color: 'var(--text-primary)', marginBottom: 4,
                    }}>{m.name}</h3>
                    <div style={{
                        fontSize: '0.78rem', fontWeight: 700,
                        color: m.accent, textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                    }}>{m.role}</div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: `linear-gradient(90deg, ${m.accent}40, transparent)`, marginBottom: 16 }} />

                {/* Roll number + college */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                    <InfoRow icon="🎓" label="Roll No." value={m.roll} accent={m.accent} mono />
                    <InfoRow icon="🏛️" label="College" value={m.college} accent={m.accent} />
                </div>

                {/* Contributions */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{
                        fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em',
                        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10,
                    }}>
                        Contributions
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {m.contrib.map(c => (
                            <span key={c} style={{
                                fontSize: '0.7rem', fontWeight: 700,
                                padding: '4px 10px', borderRadius: 8,
                                background: `${m.accent}12`, border: `1px solid ${m.accent}28`,
                                color: m.accent, fontFamily: 'var(--mono)',
                            }}>{c}</span>
                        ))}
                    </div>
                </div>

                {/* Social links (shown only if provided) */}
                {(m.github || m.linkedin) && (
                    <div style={{ display: 'flex', gap: 10, paddingTop: 16, borderTop: `1px solid ${m.accent}18` }}>
                        {m.github && (
                            <a href={m.github} target="_blank" rel="noreferrer" style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: '0.78rem', fontWeight: 700, color: m.accent,
                                textDecoration: 'none', transition: 'opacity 0.2s',
                            }} onMouseEnter={e => e.currentTarget.style.opacity = 0.7}
                                onMouseLeave={e => e.currentTarget.style.opacity = 1}>
                                ⬡ GitHub
                            </a>
                        )}
                        {m.linkedin && (
                            <a href={m.linkedin} target="_blank" rel="noreferrer" style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: '0.78rem', fontWeight: 700, color: m.accent,
                                textDecoration: 'none', transition: 'opacity 0.2s',
                            }} onMouseEnter={e => e.currentTarget.style.opacity = 0.7}
                                onMouseLeave={e => e.currentTarget.style.opacity = 1}>
                                in LinkedIn
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function InfoRow({ icon, label, value, accent, mono }) {
    return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0, minWidth: 56 }}>
                {label}
            </span>
            <span style={{
                fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600,
                fontFamily: mono ? 'var(--mono)' : 'var(--font)',
            }}>
                {value}
            </span>
        </div>
    )
}
