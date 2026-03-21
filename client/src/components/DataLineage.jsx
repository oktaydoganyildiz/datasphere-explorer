import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, RefreshCw, Search, Table, Eye, Info } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';
import { FadeScaleIn } from './PageTransition';

const lineageStyles = `
@keyframes nodeAppear { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
.lineage-node { cursor: pointer; transition: filter .15s ease; }
.lineage-node:hover { filter: brightness(1.12); }
.lineage-node.selected rect { stroke-width: 2.5px !important; }
.link-line { transition: opacity .2s ease; }
.link-line:hover { opacity: 1 !important; }
.lineage-search { transition: border-color .2s, box-shadow .2s; }
.lineage-search:focus { border-color: #378ADD; box-shadow: 0 0 0 3px rgba(55,138,221,.15); outline: none; }
.graph-btn { transition: background .15s, transform .15s; }
.graph-btn:hover { background: var(--color-background-secondary); transform: scale(1.08); }
.graph-btn:active { transform: scale(0.94); }
`;

if (!document.querySelector('#lineage-styles')) {
  const s = document.createElement('style');
  s.id = 'lineage-styles';
  s.textContent = lineageStyles;
  document.head.appendChild(s);
}

const NODE_W = 140;
const NODE_H = 44;
const TABLE_COLOR = '#378ADD';
const VIEW_COLOR  = '#7F77DD';

const formatRows = (n) => {
  if (n == null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const DetailPanel = ({ node, links, onClose }) => {
  if (!node) return null;
  const incoming = links.filter(l => l.target?.id === node.id || l.target === node.id);
  const outgoing = links.filter(l => l.source?.id === node.id || l.source === node.id);

  return (
    <div
      className="absolute top-3 right-3 w-64 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg overflow-hidden"
      style={{ zIndex: 10, animation: 'fadeScaleIn .2s ease both' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {node.type === 'VIEW'
            ? <Eye className="w-4 h-4 text-purple-500" />
            : <Table className="w-4 h-4 text-blue-500" />
          }
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">
            {node.label}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">&times;</button>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Tip</span>
          <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${
            node.type === 'VIEW'
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          }`}>{node.type}</span>
        </div>
        {node.rows != null && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Satır sayısı</span>
            <span className="font-medium text-gray-800 dark:text-white">{node.rows.toLocaleString()}</span>
          </div>
        )}
        {incoming.length > 0 && (
          <div className="text-xs">
            <p className="text-gray-500 dark:text-gray-400 mb-1">← Bağlanan ({incoming.length})</p>
            {incoming.map((l, i) => (
              <p key={i} className="text-gray-700 dark:text-gray-300 font-mono truncate">
                {l.source?.label || l.source}
              </p>
            ))}
          </div>
        )}
        {outgoing.length > 0 && (
          <div className="text-xs">
            <p className="text-gray-500 dark:text-gray-400 mb-1">→ Bağlı ({outgoing.length})</p>
            {outgoing.map((l, i) => (
              <p key={i} className="text-gray-700 dark:text-gray-300 font-mono truncate">
                {l.target?.label || l.target}
              </p>
            ))}
          </div>
        )}
        {incoming.length === 0 && outgoing.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Bu tablo için FK ilişkisi bulunamadı.</p>
        )}
      </div>
    </div>
  );
};

const DataLineage = () => {
  const { selectedSchema, schemas } = useConnectionStore();
  const [schema, setSchema]       = useState(selectedSchema || '');
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error,   setError]       = useState(null);
  const [search,  setSearch]      = useState('');
  const [selected, setSelected]   = useState(null);
  const [stats, setStats]         = useState({ nodes: 0, links: 0, tables: 0, views: 0 });

  const svgRef       = useRef(null);
  const gRef         = useRef(null);
  const simRef       = useRef(null);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const isDragging   = useRef(false);
  const dragNode     = useRef(null);
  const dragStart    = useRef({ x: 0, y: 0 });
  const panStart     = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const fetchLineage = useCallback(async (s) => {
    if (!s) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const res  = await fetch(`/api/stats/lineage/${encodeURIComponent(s)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      const nodes = (json.nodes || []).slice(0, 80).map(n => ({
        ...n,
        x: Math.random() * 600 + 100,
        y: Math.random() * 400 + 80,
        vx: 0, vy: 0,
      }));

      const idSet = new Set(nodes.map(n => n.id));
      const links = (json.links || [])
        .filter(l => idSet.has(l.source) && idSet.has(l.target))
        .map(l => ({ ...l }));

      setGraphData({ nodes, links });
      setStats({
        nodes: nodes.length,
        links: links.length,
        tables: nodes.filter(n => n.type === 'TABLE').length,
        views:  nodes.filter(n => n.type === 'VIEW').length,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (schema) fetchLineage(schema);
  }, [schema, fetchLineage]);

  const applyTransform = useCallback(() => {
    if (!gRef.current) return;
    const { x, y, k } = transformRef.current;
    gRef.current.setAttribute('transform', `translate(${x},${y}) scale(${k})`);
  }, []);

  const zoom = useCallback((delta) => {
    const t = transformRef.current;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const newK = Math.max(0.2, Math.min(3, t.k * (1 + delta)));
    t.x = cx - (cx - t.x) * (newK / t.k);
    t.y = cy - (cy - t.y) * (newK / t.k);
    t.k = newK;
    applyTransform();
  }, [applyTransform]);

  const resetView = useCallback(() => {
    transformRef.current = { x: 0, y: 0, k: 1 };
    applyTransform();
  }, [applyTransform]);

  useEffect(() => {
    if (!graphData || !svgRef.current || !gRef.current) return;
    const svg = svgRef.current;
    const g   = gRef.current;
    const { nodes, links } = graphData;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const resolvedLinks = links.map(l => ({
      ...l,
      source: typeof l.source === 'string' ? nodeMap.get(l.source) : l.source,
      target: typeof l.target === 'string' ? nodeMap.get(l.target) : l.target,
    })).filter(l => l.source && l.target);

    setGraphData(prev => ({ ...prev, links: resolvedLinks }));

    g.innerHTML = '';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    ['#378ADD', '#7F77DD'].forEach((color, ci) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', `arrow-${ci}`);
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '8'); marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '5'); marker.setAttribute('markerHeight', '5');
      marker.setAttribute('orient', 'auto-start-reverse');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M2 1L8 5L2 9');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'round');
      marker.appendChild(path);
      defs.appendChild(marker);
    });
    g.appendChild(defs);

    const linkGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    linkGroup.setAttribute('class', 'links');
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('class', 'nodes');
    g.appendChild(linkGroup);
    g.appendChild(nodeGroup);

    const linkEls = resolvedLinks.map(link => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('class', 'link-line');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', '#B4B2A9');
      line.setAttribute('stroke-width', '1.2');
      line.setAttribute('opacity', '0.55');
      line.setAttribute('marker-end', 'url(#arrow-0)');
      linkGroup.appendChild(line);
      return { el: line, link };
    });

    const nodeEls = nodes.map(node => {
      const isView  = node.type === 'VIEW';
      const color   = isView ? VIEW_COLOR : TABLE_COLOR;
      const fillBg  = isView ? '#EEEDFE' : '#E6F1FB';

      const grp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      grp.setAttribute('class', 'lineage-node');
      grp.setAttribute('data-id', node.id);

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', NODE_W);
      rect.setAttribute('height', NODE_H);
      rect.setAttribute('rx', '8');
      rect.setAttribute('fill', fillBg);
      rect.setAttribute('stroke', color);
      rect.setAttribute('stroke-width', '1.2');

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', NODE_W / 2);
      label.setAttribute('y', NODE_H / 2 - (node.rows != null ? 6 : 0));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'central');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-weight', '500');
      label.setAttribute('fill', isView ? '#3C3489' : '#0C447C');
      label.setAttribute('font-family', 'var(--font-sans, sans-serif)');
      const maxLen = 16;
      label.textContent = node.label.length > maxLen ? node.label.slice(0, maxLen) + '…' : node.label;

      grp.appendChild(rect);
      grp.appendChild(label);

      if (node.rows != null) {
        const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sub.setAttribute('x', NODE_W / 2);
        sub.setAttribute('y', NODE_H / 2 + 10);
        sub.setAttribute('text-anchor', 'middle');
        sub.setAttribute('dominant-baseline', 'central');
        sub.setAttribute('font-size', '10');
        sub.setAttribute('fill', isView ? '#534AB7' : '#185FA5');
        sub.setAttribute('font-family', 'var(--font-sans, sans-serif)');
        sub.textContent = formatRows(node.rows) + ' rows';
        grp.appendChild(sub);
      }

      grp.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDragging.current = true;
        dragNode.current   = node;
        const t = transformRef.current;
        dragStart.current = {
          x: e.clientX / t.k - node.x,
          y: e.clientY / t.k - node.y,
        };
      });

      grp.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(node);
        document.querySelectorAll('.lineage-node.selected').forEach(el => el.classList.remove('selected'));
        grp.classList.add('selected');
      });

      nodeGroup.appendChild(grp);
      return { el: grp, rect, node };
    });

    svg.addEventListener('mousedown', (e) => {
      if (e.target === svg || e.target === g) {
        panStart.current = {
          x: e.clientX, y: e.clientY,
          tx: transformRef.current.x, ty: transformRef.current.y,
        };
        isDragging.current = true;
        dragNode.current   = null;
      }
    });

    const onMouseMove = (e) => {
      if (!isDragging.current) return;
      const t = transformRef.current;
      if (dragNode.current) {
        dragNode.current.x = e.clientX / t.k - dragStart.current.x;
        dragNode.current.y = e.clientY / t.k - dragStart.current.y;
        dragNode.current.fx = dragNode.current.x;
        dragNode.current.fy = dragNode.current.y;
      } else {
        t.x = panStart.current.tx + (e.clientX - panStart.current.x);
        t.y = panStart.current.ty + (e.clientY - panStart.current.y);
        applyTransform();
      }
    };

    const onMouseUp = () => {
      isDragging.current = false;
      dragNode.current   = null;
    };

    svg.addEventListener('mousemove', onMouseMove);
    svg.addEventListener('mouseup', onMouseUp);
    svg.addEventListener('mouseleave', onMouseUp);

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 0.12 : -0.12);
    }, { passive: false });

    svg.addEventListener('click', () => {
      setSelected(null);
      document.querySelectorAll('.lineage-node.selected').forEach(el => el.classList.remove('selected'));
    });

    const FORCE_STRENGTH  = -220;
    const LINK_DIST       = 200;
    const CENTER_X        = 400;
    const CENTER_Y        = 300;
    const ALPHA_DECAY     = 0.025;
    let   alpha           = 1;
    let   rafId;

    const tick = () => {
      alpha *= (1 - ALPHA_DECAY);
      if (alpha < 0.001) { cancelAnimationFrame(rafId); return; }

      nodes.forEach(n => {
        if (n.fx != null) { n.x = n.fx; n.vy = 0; return; }
        n.vx += (CENTER_X - n.x) * 0.008 * alpha;
        n.vy += (CENTER_Y - n.y) * 0.008 * alpha;
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const distSq = dx * dx + dy * dy + 0.01;
          const dist   = Math.sqrt(distSq);
          const force  = (FORCE_STRENGTH / distSq) * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (a.fx == null) { a.vx -= fx; a.vy -= fy; }
          if (b.fx == null) { b.vx += fx; b.vy += fy; }
        }
      }

      resolvedLinks.forEach(({ source: s, target: t }) => {
        if (!s || !t) return;
        const dx    = t.x - s.x, dy = t.y - s.y;
        const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
        const diff  = (dist - LINK_DIST) / dist * 0.3 * alpha;
        const fx = dx * diff, fy = dy * diff;
        if (s.fx == null) { s.vx += fx; s.vy += fy; }
        if (t.fx == null) { t.vx -= fx; t.vy -= fy; }
      });

      nodes.forEach(n => {
        if (n.fx != null) return;
        n.vx *= 0.6; n.vy *= 0.6;
        n.x  += n.vx; n.y  += n.vy;
      });

      nodeEls.forEach(({ el, node: n }) => {
        el.setAttribute('transform', `translate(${n.x - NODE_W / 2},${n.y - NODE_H / 2})`);
      });

      linkEls.forEach(({ el, link }) => {
        const s = link.source, t = link.target;
        if (!s || !t) return;
        const dx = t.x - s.x, dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ex = (dx / dist) * (NODE_W / 2 + 2);
        const ey = (dy / dist) * (NODE_H / 2 + 2);
        el.setAttribute('d', `M${s.x},${s.y} L${t.x - ex},${t.y - ey}`);
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      svg.removeEventListener('mousemove', onMouseMove);
      svg.removeEventListener('mouseup',  onMouseUp);
      svg.removeEventListener('mouseleave', onMouseUp);
    };
  }, [graphData?.nodes?.length, applyTransform, zoom]);

  const filteredIds = search
    ? new Set(graphData?.nodes.filter(n => n.label.toLowerCase().includes(search.toLowerCase())).map(n => n.id))
    : null;

  useEffect(() => {
    if (!filteredIds) {
      document.querySelectorAll('.lineage-node').forEach(el => el.style.opacity = '1');
      return;
    }
    document.querySelectorAll('.lineage-node').forEach(el => {
      el.style.opacity = filteredIds.has(el.getAttribute('data-id')) ? '1' : '0.2';
    });
  }, [search]);

  return (
    <div className="p-6 flex flex-col gap-5" style={{ height: '100%' }}>
      <FadeScaleIn delay={0}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Data Lineage</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tablolar arası ilişkiler ve veri akışı</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: `${stats.tables} tablo`, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
              { label: `${stats.views} view`,   color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
              { label: `${stats.links} ilişki`, color: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300' },
            ].map(b => (
              <span key={b.label} className={`text-xs px-2.5 py-1 rounded-full font-medium ${b.color}`}>{b.label}</span>
            ))}
          </div>
        </div>
      </FadeScaleIn>

      <FadeScaleIn delay={80}>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
            value={schema}
            onChange={e => setSchema(e.target.value)}
          >
            <option value="" disabled>Şema seç</option>
            {schemas.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tablo ara…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="lineage-search w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>

          <button onClick={() => fetchLineage(schema)} className="graph-btn p-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => zoom(0.2)}  className="graph-btn p-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400"><ZoomIn  className="w-4 h-4" /></button>
          <button onClick={() => zoom(-0.2)} className="graph-btn p-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={resetView}        className="graph-btn p-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400"><Maximize2 className="w-4 h-4" /></button>
        </div>
      </FadeScaleIn>

      <div className="flex-1 relative bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden" style={{ minHeight: 420 }}>
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/80 dark:bg-slate-800/80">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Graf oluşturuluyor…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500">
            <Info className="w-8 h-8 mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!schema && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <Table className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Bir şema seçin</p>
          </div>
        )}

        <svg
          ref={svgRef}
          width="100%" height="100%"
          style={{ display: 'block', cursor: 'grab', userSelect: 'none' }}
        >
          <g ref={gRef} />
        </svg>

        {selected && (
          <DetailPanel
            node={selected}
            links={graphData?.links || []}
            onClose={() => setSelected(null)}
          />
        )}

        <div className="absolute bottom-3 left-3 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 pointer-events-none">
          <span className="flex items-center gap-1">
            <span style={{ width:10,height:10,borderRadius:2,background:'#E6F1FB',border:'1.2px solid #378ADD',display:'inline-block' }} />
            Tablo
          </span>
          <span className="flex items-center gap-1">
            <span style={{ width:10,height:10,borderRadius:2,background:'#EEEDFE',border:'1.2px solid #7F77DD',display:'inline-block' }} />
            View
          </span>
          <span className="text-gray-300 dark:text-gray-600">· Sürükle · Scroll zoom · Tıkla detay</span>
        </div>
      </div>
    </div>
  );
};

export default DataLineage;
