import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Brain, BarChart3, Zap, ArrowRight,
  Terminal, Database, ChevronDown, Clock,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════
   1. PARTICLE CANVAS — Neural network background
   ═══════════════════════════════════════════════════════════════════════ */

const PARTICLE_COLOR = { r: 96, g: 165, b: 250 }; // Electric Blue #60a5fa
const LINE_COLOR = { r: 34, g: 211, b: 238 }; // Cyan #22d3ee

function NeuralCanvas() {
  const ref = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const particles = useRef([]);
  const raf = useRef(null);

  const createParticle = useCallback((W, H) => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    r: Math.random() * 1.6 + 0.6,
    alpha: Math.random() * 0.25 + 0.55,
    pulse: Math.random() * Math.PI * 2,
  }), []);

  useEffect(() => {
    const cvs = ref.current;
    const ctx = cvs.getContext('2d');
    let W, H;

    function resize() {
      W = cvs.width = window.innerWidth;
      H = cvs.height = window.innerHeight;
      const count = Math.min(Math.floor((W * H) / 5800), 280);
      particles.current = Array.from({ length: count }, () => createParticle(W, H));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const pts = particles.current;
      const t = Date.now() * 0.001;
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const { r: cr, g: cg, b: cb } = PARTICLE_COLOR;
      const { r: lr, g: lg, b: lb } = LINE_COLOR;

      // — Connections —
      const maxDist = 150;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = dx * dx + dy * dy;
          if (dist < maxDist * maxDist) {
            const a = (1 - Math.sqrt(dist) / maxDist) * 0.46;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(${lr},${lg},${lb},${a})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // — Particles —
      for (const p of pts) {
        // Mouse repulsion
        const mdx = p.x - mx;
        const mdy = p.y - my;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md > 0 && md < 160) {
          const f = (160 - md) / 160 * 0.6;
          p.vx += (mdx / md) * f * 0.08;
          p.vy += (mdy / md) * f * 0.08;
        }

        p.vx *= 0.996;
        p.vy *= 0.996;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20;
        if (p.y > H + 20) p.y = -20;

        const pulse = Math.sin(t * 1.2 + p.pulse) * 0.22 + 0.78;
        const a = p.alpha * pulse;

        // Glow
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
        grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},${a * 0.28})`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(a * 1.9, 1)})`;
        ctx.fill();
      }

      // Random data burst
      if (Math.random() < 0.03 && pts.length) {
        const p = pts[Math.floor(Math.random() * pts.length)];
        const bg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 12);
        bg.addColorStop(0, `rgba(${cr},${cg},${cb},0.72)`);
        bg.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 12, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();
      }

      raf.current = requestAnimationFrame(draw);
    }

    const onMove = (e) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };

    resize();
    draw();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseout', onLeave);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
    };
  }, [createParticle]);

  return (
    <canvas
      ref={ref}
      className="fixed inset-0 z-0"
      style={{
        opacity: 0.68,
        background: 'linear-gradient(135deg, #050810 0%, #0a0e1a 40%, #080c18 100%)',
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   2. ANIMATED TITLE — Letters assembling from particles
   ═══════════════════════════════════════════════════════════════════════ */

function AnimatedTitle({ text, className }) {
  const letters = text.split('');

  return (
    <span className={className} aria-label={text}>
      {letters.map((char, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)', scale: 0.7 }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
          transition={{
            delay: 0.4 + i * 0.04,
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   3. GLOWING CTA BUTTON
   ═══════════════════════════════════════════════════════════════════════ */

function GlowButton({ children, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className="relative group px-8 py-3.5 rounded-xl font-semibold text-white text-sm
                 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600
                 overflow-hidden transition-all duration-300 cursor-pointer"
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Animated shimmer overlay */}
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                       -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      {/* Outer glow */}
      <span className="absolute -inset-1 bg-blue-500/30 rounded-xl blur-lg
                       opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
      <span className="relative flex items-center gap-2">
        {children}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </span>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   4. GLASSMORPHISM FEATURE CARD
   ═══════════════════════════════════════════════════════════════════════ */

function FeatureCard({ icon: Icon, title, description, color, delay }) {
  const colorMap = {
    blue:   { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', glow: 'group-hover:shadow-blue-500/10' },
    violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400', glow: 'group-hover:shadow-violet-500/10' },
    cyan:   { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', glow: 'group-hover:shadow-cyan-500/10' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      className={`group relative rounded-2xl p-6 backdrop-blur-xl
                  bg-white/[0.03] border border-white/[0.06]
                  hover:border-white/[0.12] transition-all duration-300
                  hover:-translate-y-1 hover:shadow-2xl ${c.glow}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent ${c.text} to-transparent
                       opacity-0 group-hover:opacity-40 transition-opacity`} />

      <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border}
                       flex items-center justify-center mb-5`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <h3 className="text-lg font-bold text-white mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   5. LIVE DATA FEED — Terminal simulation
   ═══════════════════════════════════════════════════════════════════════ */

const FEED_TEMPLATES = [
  () => ({ icon: '●', color: 'text-emerald-400', msg: `Global Node ${Math.floor(Math.random()*20+1)} aktif`, ts: new Date().toLocaleTimeString() }),
  () => ({ icon: '◆', color: 'text-blue-400', msg: `API Call ${Math.floor(Math.random()*200+50)}ms`, ts: new Date().toLocaleTimeString() }),
  () => ({ icon: '▲', color: 'text-amber-400', msg: `Data Stream: ${(Math.random()*5+1).toFixed(1)} GB/s`, ts: new Date().toLocaleTimeString() }),
  () => ({ icon: '■', color: 'text-violet-400', msg: `Query optimized: -${Math.floor(Math.random()*40+10)}% latency`, ts: new Date().toLocaleTimeString() }),
  () => ({ icon: '●', color: 'text-cyan-400', msg: `Schema sync: ${Math.floor(Math.random()*50+10)} tables indexed`, ts: new Date().toLocaleTimeString() }),
  () => ({ icon: '◆', color: 'text-rose-400', msg: `Anomaly scan: ${Math.floor(Math.random()*1000+100)} rows checked`, ts: new Date().toLocaleTimeString() }),
  () => ({ icon: '▲', color: 'text-emerald-400', msg: `Connection pool: ${Math.floor(Math.random()*8+2)}/10 active`, ts: new Date().toLocaleTimeString() }),
  () => ({ icon: '■', color: 'text-blue-400', msg: `Cache hit rate: ${(Math.random()*10+89).toFixed(1)}%`, ts: new Date().toLocaleTimeString() }),
];

function DataFeed() {
  const [lines, setLines] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Seed initial lines
    const initial = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      ...FEED_TEMPLATES[Math.floor(Math.random() * FEED_TEMPLATES.length)](),
    }));
    setLines(initial);
    let counter = initial.length;

    const interval = setInterval(() => {
      const tmpl = FEED_TEMPLATES[Math.floor(Math.random() * FEED_TEMPLATES.length)];
      setLines((prev) => {
        const next = [...prev, { id: counter++, ...tmpl() }];
        return next.slice(-12); // Keep last 12 lines
      });
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden
                 bg-black/40 backdrop-blur-xl border border-white/[0.06]"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest ml-2">
            datasphere://live-feed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
          <span className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Feed content */}
      <div ref={scrollRef} className="p-4 h-56 overflow-y-auto font-mono text-xs space-y-1.5
                                       scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div
              key={line.id}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <span className="text-slate-600 text-[10px] shrink-0 w-16">{line.ts}</span>
              <span className={`${line.color} text-[8px]`}>{line.icon}</span>
              <span className="text-slate-300">{line.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   6. MAIN LANDING PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export default function DatasphereLanding({ onEnter }) {
  return (
    <div className="relative min-h-screen text-white overflow-x-hidden">
      {/* Background particle canvas */}
      <NeuralCanvas />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_50%_38%,rgba(5,8,16,0.08)_0%,rgba(5,8,16,0.32)_58%,rgba(5,8,16,0.56)_100%)]" />

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between
                        bg-black/30 backdrop-blur-2xl border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600
                            flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight text-white drop-shadow-[0_0_12px_rgba(96,165,250,0.35)]">
              Datasphere Explorer
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#modules" className="hover:text-white transition-colors">Modules</a>
            <span className="hover:text-white transition-colors cursor-pointer">Quick Start</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full
                            bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Online</span>
            </div>
            <button
              onClick={onEnter}
              className="text-xs font-semibold px-4 py-2 rounded-lg
                         bg-white/[0.06] border border-white/[0.08] text-white
                         hover:bg-white/[0.1] hover:border-white/[0.15] transition-all cursor-pointer"
            >
              Connect
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center
                          text-center px-6 pt-20 pb-12">
        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[800px] h-[500px] pointer-events-none
                        bg-[radial-gradient(ellipse,rgba(96,165,250,0.08)_0%,transparent_70%)]" />

        {/* Badge */}
        <motion.div
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full
                     bg-blue-500/[0.07] border border-blue-500/20 mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Zap className="w-3 h-3 text-blue-400" />
          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
            SAP HANA &amp; DataSphere Toolkit
          </span>
        </motion.div>

        {/* Title — letters animate in like data particles assembling */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[0.9] tracking-tight mb-6">
          <AnimatedTitle
            text="Datasphere"
            className="block text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.35)]"
          />
          <AnimatedTitle
            text="Explorer"
            className="block text-white drop-shadow-[0_0_28px_rgba(96,165,250,0.5)]"
          />
        </h1>

        {/* Subtitle */}
        <motion.p
          className="text-base sm:text-lg text-slate-400 max-w-lg leading-relaxed mb-10 font-light"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.7 }}
        >
          Connect to your DataSphere or SAP HANA instance, explore schemas, run SQL, and monitor platform health from one workspace.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <GlowButton onClick={onEnter}>
            Open Workspace
          </GlowButton>
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="flex flex-wrap gap-1 mt-16 rounded-2xl overflow-hidden
                     bg-white/[0.02] border border-white/[0.05]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.7 }}
        >
          {[
            { value: '7', label: 'Built-in Modules', color: 'text-blue-400' },
            { value: 'SQL Playground', label: 'Editor + Templates', color: 'text-cyan-400' },
            { value: 'CSV Import', label: 'Table Loader', color: 'text-emerald-400' },
            { value: 'Query History', label: 'Saved Runs', color: 'text-violet-400' },
          ].map((s, i) => (
            <div key={i} className="px-6 sm:px-8 py-4 text-center">
              <div className={`text-xl sm:text-2xl font-extrabold ${s.color} tracking-tight`}>
                {s.value}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
        >
          <span className="text-[10px] text-slate-600 uppercase tracking-[0.2em] font-semibold">
            Scroll to explore
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          >
            <ChevronDown className="w-4 h-4 text-slate-600" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── FEATURES SECTION ── */}
      <section id="features" className="relative z-10 py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-3 block">
              Core Features
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
              Built Around Real Product Features
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Everything on this page maps directly to the modules in the app.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            <FeatureCard
              icon={Globe}
              title="Data Explorer"
              description="Browse schemas and tables, preview the first rows, and profile columns with distribution metrics."
              color="blue"
              delay={0}
            />
            <FeatureCard
              icon={Brain}
              title="Smart Query"
              description="Generate SQL from natural language prompts and get fast suggestions tailored for operational analysis."
              color="violet"
              delay={0.12}
            />
            <FeatureCard
              icon={Terminal}
              title="SQL Playground"
              description="Write and run custom SQL with snippets, table placeholders, and result grid feedback."
              color="cyan"
              delay={0.24}
            />
          </div>
        </div>
      </section>

      {/* ── MODULES SECTION ── */}
      <section id="modules" className="relative z-10 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-3 block">
              Workspace Modules
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
              Daily Workflow in One Place
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              From monitoring to import and history tracking, these modules are available in the sidebar right now.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            <FeatureCard
              icon={BarChart3}
              title="Dashboard & Health Monitor"
              description="Track table/view counts, storage usage, and task-chain status from operational dashboards."
              color="blue"
              delay={0}
            />
            <FeatureCard
              icon={Database}
              title="CSV Import"
              description="Upload CSV files, map data types, and create HANA tables directly in the selected schema."
              color="violet"
              delay={0.12}
            />
            <FeatureCard
              icon={Clock}
              title="Query History"
              description="Review previous SQL runs, search by schema, and keep reusable statements close to your workflow."
              color="cyan"
              delay={0.24}
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <section className="relative z-10 py-24 px-6">
        <motion.div
          className="max-w-xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Ready to Start Working with Your Data?
          </h2>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            Connect your SAP HANA or DataSphere environment and open the full analytics workspace.
          </p>
          <GlowButton onClick={onEnter}>
            Connect and Continue
          </GlowButton>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600
                            flex items-center justify-center">
              <Database className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-200">Datasphere Explorer</span>
          </div>
          <p className="text-[10px] text-slate-600">
            © {new Date().getFullYear()} Datasphere Explorer — SAP HANA Cloud & DataSphere
          </p>
        </div>
      </footer>
    </div>
  );
}
