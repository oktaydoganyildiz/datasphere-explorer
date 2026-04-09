import React, { useRef, useEffect, useCallback } from 'react';

const PARTICLE_COLOR = { r: 96, g: 165, b: 250 };

export default function NeuralBackground({ opacity = 0.3 }) {
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
    alpha: Math.random() * 0.35 + 0.35,
    pulse: Math.random() * Math.PI * 2,
  }), []);

  useEffect(() => {
    const cvs = ref.current;
    const ctx = cvs.getContext('2d');
    let W, H;

    function resize() {
      W = cvs.width = window.innerWidth;
      H = cvs.height = window.innerHeight;
      const count = Math.min(Math.floor((W * H) / 7000), 220);
      particles.current = Array.from({ length: count }, () => createParticle(W, H));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const pts = particles.current;
      const t = Date.now() * 0.001;
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const { r: cr, g: cg, b: cb } = PARTICLE_COLOR;

      const maxDist = 130;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = dx * dx + dy * dy;
          if (dist < maxDist * maxDist) {
            const a = (1 - Math.sqrt(dist) / maxDist) * 0.22;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(${cr},${cg},${cb},${a})`;
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }
        }
      }

      for (const p of pts) {
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

        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20;
        if (p.y > H + 20) p.y = -20;

        const pulse = Math.sin(t * 1.2 + p.pulse) * 0.22 + 0.78;
        const a = p.alpha * pulse;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
        grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},${a * 0.28})`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(a * 1.9, 1)})`;
        ctx.fill();
      }

      if (Math.random() < 0.02 && pts.length) {
        const p = pts[Math.floor(Math.random() * pts.length)];
        const bg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 12);
        bg.addColorStop(0, `rgba(${cr},${cg},${cb},0.58)`);
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
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity }}
    />
  );
}
