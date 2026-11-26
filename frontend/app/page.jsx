"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, animate, useReducedMotion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ───────────── data helpers ───────────── */
const API = process.env.NEXT_PUBLIC_API || "http://localhost:8000";
const call = async (u, opt) => { const r = await fetch(API + u, opt); if (!r.ok) throw new Error(r.status); return r.json(); };
const post = (u, b) => call(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const get = u => call(u);

const C = { cyan: "#22e5ff", amethyst: "#8b5cf6", soft: "#b79cff", orchid: "#ff5fa2", mint: "#4ff0b0", mist: "#8f8ba6" };
const PCOLOR = { cpu: C.cyan, hybrid: C.soft, hetero: C.orchid, accel: C.mint };
const SHORT = { cpu: "CPU", hybrid: "CPU + GPU", hetero: "CPU + GPU + NPU", accel: "NPU / TPU" };
const TABS = [["Simulate", "play"], ["Compare", "bars"], ["Quantum", "molecule"], ["History", "clock"]];

/* ───────────── icons ───────────── */
const PATHS = {
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>,
  weather: <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />,
  molecule: <><circle cx="12" cy="12" r="1" /><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" /><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" /></>,
  matrix: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  play: <polygon points="6 3 20 12 6 21 6 3" />,
  pause: <><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></>,
  replay: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>,
  expand: <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />,
  trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  bars: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
};
const Icon = ({ name, size = 18, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{PATHS[name]}</svg>
);

/* ───────────── small building blocks ───────────── */
function Num({ v, d = 0 }) {
  const [x, setX] = useState(v), prev = useRef(v);
  useEffect(() => { const c = animate(prev.current, v, { duration: 0.7, ease: "easeOut", onUpdate: setX }); prev.current = v; return () => c.stop(); }, [v]);
  return <>{x.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}</>;
}

const Panel = ({ title, hint, right, children, className = "" }) => (
  <section className={`panel p-5 ${className}`}>
    {(title || right) && <header className="mb-4 flex items-start justify-between gap-3">
      <div><h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>{hint && <p className="mt-1 text-xs leading-relaxed text-mist">{hint}</p>}</div>{right}
    </header>}
    {children}
  </section>
);

const Tip = ({ active, payload, label, unit = "" }) => !active || !payload?.length ? null : (
  <div className="rounded-xl border border-white/10 bg-black/90 px-3 py-2 text-xs shadow-xl backdrop-blur">
    <div className="mb-1 font-semibold text-white">{label}</div>
    {payload.map(p => <div key={p.dataKey} className="flex items-center gap-2 text-mist"><span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />{p.name || p.dataKey}: <b className="text-white">{p.value}{unit}</b></div>)}
  </div>
);
const axis = { tick: { fill: C.mist, fontSize: 11 }, axisLine: { stroke: "#1f1b2e" }, tickLine: false };

function TaskPicker({ cfg, task, size, onTask, onSize }) {
  const t = cfg.tasks[task], pct = ((size - t.min) / (t.max - t.min)) * 100;
  return (
    <Panel title="Workload" hint="Pick what the computer has to process, then set how much of it.">
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(cfg.tasks).map(([k, v]) => (
          <button key={k} aria-pressed={task === k} onClick={() => onTask(k)} className="chip flex items-center gap-2.5 p-3 text-left text-sm font-medium">
            <span className={task === k ? "text-cyan-electric" : "text-mist"}><Icon name={k} /></span>{v.name}
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-baseline justify-between text-sm">
        <label htmlFor="size" className="text-mist">Amount</label>
        <span className="font-display text-lg font-semibold"><Num v={size} /> <span className="text-xs font-normal text-mist">{t.unit}</span></span>
      </div>
      <input id="size" type="range" className="range mt-3" style={{ "--p": pct + "%" }} min={t.min} max={t.max} step={Math.max(1, Math.round((t.max - t.min) / 200))} value={size} onChange={e => onSize(+e.target.value)} />
    </Panel>
  );
}

/* ───────────── compute fabric (the centerpiece) ───────────── */
const NODES = [
  { id: "cpu", label: "CPU", x: 92, y: 150, color: C.cyan },
  { id: "gpu", label: "GPU", x: 508, y: 66, color: C.soft },
  { id: "npu", label: "NPU", x: 508, y: 234, color: C.orchid },
];
const HUB = { x: 300, y: 150 };
const R = 34, CIRC = 2 * Math.PI * R;
const bucket = u => (u < 3 ? 0 : u < 35 ? 1 : u < 65 ? 2 : 3);
const DUR = [0, 3, 2, 1.3];

function Fabric({ now, playing }) {
  const calm = useReducedMotion();
  return (
    <svg viewBox="0 0 600 300" className="h-auto w-full" role="img" aria-label="Live load on CPU, GPU and NPU">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        {NODES.map(n => <linearGradient key={n.id} id={`lg-${n.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={n.color} /><stop offset="1" stopColor={C.amethyst} /></linearGradient>)}
      </defs>
      {NODES.map(n => {
        const u = now?.[n.id] ?? 0, b = bucket(u), d = `M${n.x},${n.y} L${HUB.x},${HUB.y}`;
        const rev = n.id === "cpu" ? "M" + n.x + "," + n.y + " L" + HUB.x + "," + HUB.y : `M${HUB.x},${HUB.y} L${n.x},${n.y}`;
        return (
          <g key={n.id}>
            <path d={d} stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeDasharray="3 7" fill="none" />
            {playing && !calm && b > 0 && Array.from({ length: b }).map((_, k) => (
              <circle key={`${b}-${k}`} r="4.5" fill={n.color} filter="url(#glow)">
                <animateMotion dur={`${DUR[b]}s`} begin={`-${(k * DUR[b]) / b}s`} repeatCount="indefinite" path={rev} />
              </circle>
            ))}
          </g>
        );
      })}
      {/* memory hub */}
      <g>
        <rect x={HUB.x - 40} y={HUB.y - 24} width="80" height="48" rx="14" fill="#0c0a14" stroke="rgba(139,92,246,0.55)" />
        <text x={HUB.x} y={HUB.y - 2} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600">Memory</text>
        <text x={HUB.x} y={HUB.y + 14} textAnchor="middle" fill={C.mist} fontSize="10">{now ? `${now.ram} GB RAM` : "idle"}</text>
      </g>
      {NODES.map(n => {
        const u = now?.[n.id] ?? 0;
        return (
          <g key={n.id} style={{ opacity: u > 0 ? 1 : 0.6, transition: "opacity .4s" }}>
            <circle cx={n.x} cy={n.y} r={R + 10} fill={n.color} opacity={u > 0 ? 0.07 + u / 1000 : 0.02} />
            <circle cx={n.x} cy={n.y} r={R} fill="#07060c" stroke="#1c1830" strokeWidth="6" />
            <circle cx={n.x} cy={n.y} r={R} fill="none" stroke={`url(#lg-${n.id})`} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - u / 100)} transform={`rotate(-90 ${n.x} ${n.y})`}
              filter={u > 0 ? "url(#glow)" : undefined} style={{ transition: "stroke-dashoffset .35s ease" }} />
            <text x={n.x} y={n.y + 5} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700">{Math.round(u)}%</text>
            <text x={n.x} y={n.y + R + 22} textAnchor="middle" fill={C.mist} fontSize="12" fontWeight="600">{n.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

const Meter = ({ label, value, unit }) => (
  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
    <div className="font-display text-lg font-semibold leading-none">{value ?? 0}<span className="ml-0.5 text-[11px] font-normal text-mist">{unit}</span></div>
    <div className="mt-1 text-[11px] text-mist">{label}</div>
  </div>
);

/* ───────────── pages ───────────── */
function Simulate({ cfg, task, size, par, setPar, onTask, onSize, run, prog, playing, start, toggle }) {
  const now = run?.timeline[prog], done = prog >= 100, e = run?.estimate;
  const stageIdx = done ? cfg.stages.length : prog === 0 ? -1 : Math.floor(prog / 20);
  const total = e ? e.processing + e.transfer + e.overhead : 1;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-5">
        <TaskPicker cfg={cfg} task={task} size={size} onTask={onTask} onSize={onSize} />
        <Panel title="Method" hint="Choose how the work is split across processors.">
          <div role="radiogroup" className="space-y-2">
            {Object.entries(cfg.paradigms).map(([k, v]) => (
              <button key={k} role="radio" aria-checked={par === k} onClick={() => setPar(k)} className="relative block w-full rounded-2xl p-3.5 text-left">
                {par === k && <motion.span layoutId="method-hl" className="absolute inset-0 rounded-2xl border border-cyan-electric/60 bg-cyan-electric/[0.06]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                <span className={`absolute inset-0 rounded-2xl border ${par === k ? "border-transparent" : "border-white/[0.08]"}`} />
                <span className="relative flex items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PCOLOR[k], boxShadow: par === k ? `0 0 12px ${PCOLOR[k]}` : "none" }} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{v.name}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-mist">{v.why}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={start} className="btn btn-primary flex-1"><Icon name={done ? "replay" : "play"} size={16} />{done ? "Run again" : "Start simulation"}</button>
            <button onClick={toggle} disabled={!run || done} className="btn btn-ghost" aria-label={playing ? "Pause" : "Resume"}><Icon name={playing ? "pause" : "play"} size={16} />{playing ? "Pause" : "Resume"}</button>
          </div>
        </Panel>
      </div>

      <div className="space-y-5">
        <Panel title="Live compute fabric" hint={run ? `${cfg.paradigms[par].name} on ${cfg.tasks[task].name.toLowerCase()}` : "Start a simulation to watch data move between processors."}
          right={<span className={`rounded-full px-3 py-1 text-xs font-semibold ${playing ? "bg-cyan-electric/10 text-cyan-electric" : done ? "bg-mint/10 text-mint" : "bg-white/5 text-mist"}`}>{playing ? "Running" : done ? "Finished" : run ? "Paused" : "Idle"}</span>}>
          <Fabric now={now} playing={playing} />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Meter label="RAM" value={now?.ram} unit=" GB" /><Meter label="VRAM" value={now?.vram} unit=" GB" /><Meter label="Power" value={now?.power} unit=" W" />
          </div>
          <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${C.cyan}, ${C.amethyst})` }} animate={{ width: prog + "%" }} transition={{ duration: 0.12, ease: "linear" }} />
            {playing && <span className="absolute inset-y-0 left-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent" />}
          </div>
          <ol className="mt-4 grid grid-cols-5 gap-1.5">
            {cfg.stages.map((s, k) => {
              const st = k < stageIdx ? "done" : k === stageIdx ? "on" : "wait";
              return (
                <li key={s} className="text-center">
                  <div className={`mx-auto mb-1.5 grid h-6 w-6 place-items-center rounded-full border text-[10px] transition-colors duration-300 ${st === "done" ? "border-mint/60 bg-mint/15 text-mint" : st === "on" ? "border-cyan-electric bg-cyan-electric/15 text-cyan-electric" : "border-white/10 text-mist"}`}>
                    {st === "done" ? <Icon name="check" size={12} /> : st === "on" ? <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-cyan-electric" /> : k + 1}
                  </div>
                  <div className={`text-[11px] leading-tight ${st === "wait" ? "text-mist" : "text-white"}`}>{s}</div>
                </li>
              );
            })}
          </ol>
        </Panel>

        <AnimatePresence>
          {e && (
            <motion.div key={`${run.timeline.length}-${e.total}-${par}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
              <Panel title="Estimated result" hint="T = processing + transfer + overhead,  E = power × time">
                <div className="grid grid-cols-3 gap-3">
                  {[["Total time", e.total, " s", 2, "clock"], ["Energy", e.energy_wh, " Wh", 3, "zap"], ["Power draw", e.power_w, " W", 0, "zap"]].map(([l, v, u, dd, ic]) => (
                    <div key={l} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-mist"><Icon name={ic} size={13} />{l}</div>
                      <div className="mt-2 font-display text-2xl font-semibold"><Num v={v} d={dd} /><span className="ml-1 text-xs font-normal text-mist">{u}</span></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/5">
                  {[["processing", C.cyan], ["transfer", C.amethyst], ["overhead", C.orchid]].map(([k, c]) => <motion.div key={k} initial={{ width: 0 }} animate={{ width: (e[k] / total) * 100 + "%" }} transition={{ duration: 0.8, ease: "easeOut" }} style={{ background: c }} />)}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-mist">
                  {[["Processing", e.processing, C.cyan], ["Transfer", e.transfer, C.amethyst], ["Overhead", e.overhead, C.orchid]].map(([l, v, c]) => <span key={l} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{l} {v} s</span>)}
                </div>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        <Panel title="Processor load over time">
          <div className="h-52">
            <ResponsiveContainer>
              <AreaChart data={run ? run.timeline.slice(0, prog + 1) : []} margin={{ left: -18, right: 6, top: 6 }}>
                <defs>{[["cpu", C.cyan], ["gpu", C.soft], ["npu", C.orchid]].map(([k, c]) => <linearGradient key={k} id={`ar-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} stopOpacity=".35" /><stop offset="1" stopColor={c} stopOpacity="0" /></linearGradient>)}</defs>
                <CartesianGrid stroke="#17141f" vertical={false} />
                <XAxis dataKey="progress" type="number" domain={[0, 100]} unit="%" {...axis} /><YAxis domain={[0, 100]} {...axis} />
                <Tooltip content={<Tip unit="%" />} cursor={{ stroke: "#2b2640" }} />
                {[["cpu", C.cyan], ["gpu", C.soft], ["npu", C.orchid]].map(([k, c]) => <Area key={k} name={k.toUpperCase()} dataKey={k} stroke={c} strokeWidth={2} fill={`url(#ar-${k})`} isAnimationActive={false} />)}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Compare({ cfg, task, size, onTask, onSize, cmp }) {
  const [metric, setMetric] = useState("time");
  if (!cmp.length) return <div className="panel h-64 animate-pulse" />;
  const cpu = cmp.find(c => c.paradigm === "cpu") || cmp[0];
  const fastest = cmp.reduce((a, b) => (b.total < a.total ? b : a)), thrifty = cmp.reduce((a, b) => (b.energy_wh < a.energy_wh ? b : a));
  const max = Math.max(...cmp.map(c => c.total));
  const data = cmp.map(c => ({ ...c, short: SHORT[c.paradigm] }));
  const ranked = [...cmp].sort((a, b) => a.total - b.total);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      <TaskPicker cfg={cfg} task={task} size={size} onTask={onTask} onSize={onSize} />
      <div className="space-y-5">
        <Panel title={`${cfg.tasks[task].name} · ${size.toLocaleString()} ${cfg.tasks[task].unit}`}
          right={<div className="flex rounded-full border border-white/10 p-1 text-xs font-semibold">{[["time", "Time"], ["energy", "Energy"]].map(([k, l]) => (
            <button key={k} onClick={() => setMetric(k)} aria-pressed={metric === k} className={`relative rounded-full px-3.5 py-1.5 transition-colors ${metric === k ? "text-white" : "text-mist"}`}>
              {metric === k && <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-full bg-amethyst/70" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}<span className="relative">{l}</span>
            </button>))}</div>}>
          <div className="h-64">
            <ResponsiveContainer>
              {metric === "time" ? (
                <BarChart data={data} margin={{ left: -10, right: 6, top: 6 }}>
                  <CartesianGrid stroke="#17141f" vertical={false} />
                  <XAxis dataKey="short" {...axis} /><YAxis unit=" s" {...axis} /><Tooltip content={<Tip unit=" s" />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
                  <Bar dataKey="processing" stackId="a" fill={C.cyan} /><Bar dataKey="transfer" stackId="a" fill={C.amethyst} /><Bar dataKey="overhead" stackId="a" fill={C.orchid} radius={[8, 8, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={data} margin={{ left: -10, right: 6, top: 6 }}>
                  <CartesianGrid stroke="#17141f" vertical={false} />
                  <XAxis dataKey="short" {...axis} /><YAxis unit=" Wh" {...axis} /><Tooltip content={<Tip unit=" Wh" />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
                  <Bar dataKey="energy_wh" name="Energy" radius={[8, 8, 0, 0]}>{data.map(d => <Cell key={d.paradigm} fill={PCOLOR[d.paradigm]} />)}</Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {metric === "time" && <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-mist">{[["Processing", C.cyan], ["Transfer", C.amethyst], ["Overhead", C.orchid]].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>)}</div>}
        </Panel>

        <Panel title="Why the differences?" hint="Ranked from fastest to slowest.">
          <div className="space-y-3">
            {ranked.map((c, k) => (
              <motion.div key={c.paradigm} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.06, duration: 0.35 }} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PCOLOR[c.paradigm] }} />
                  <h3 className="font-display text-sm font-semibold">{c.name}</h3>
                  {c === fastest && <span className="rounded-full bg-cyan-electric/12 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-electric">Fastest</span>}
                  {c === thrifty && <span className="rounded-full bg-mint/12 px-2.5 py-0.5 text-[11px] font-semibold text-mint">Most efficient</span>}
                  <span className="ml-auto text-sm"><b className="font-display">{c.total} s</b> <span className="text-xs text-mist">· {c.energy_wh} Wh · {(cpu.total / c.total).toFixed(1)}× vs CPU</span></span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><motion.div className="h-full rounded-full" style={{ background: PCOLOR[c.paradigm] }} initial={{ width: 0 }} animate={{ width: (c.total / max) * 100 + "%" }} transition={{ duration: 0.8, ease: "easeOut" }} /></div>
                <p className="mt-3 text-xs leading-relaxed text-mist">{c.why}</p>
              </motion.div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Circuit() {
  const wire = { stroke: "#3a3358", strokeWidth: 2 };
  return (
    <svg viewBox="0 0 360 130" className="h-auto w-full" role="img" aria-label="Circuit: Hadamard gate on qubit 0, then CNOT onto qubit 1">
      {[40, 92].map((y, k) => <g key={y}>
        <text x="4" y={y + 5} fill={C.mist} fontSize="13">q{k}</text>
        <motion.line x1="34" x2="340" y1={y} y2={y} {...wire} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: k * 0.15 }} />
      </g>)}
      <motion.g initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }} style={{ transformOrigin: "88px 40px" }}>
        <rect x="68" y="20" width="40" height="40" rx="10" fill="#120d24" stroke={C.cyan} /><text x="88" y="46" textAnchor="middle" fill="#fff" fontWeight="700" fontSize="16">H</text>
      </motion.g>
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
        <line x1="184" y1="40" x2="184" y2="92" stroke={C.amethyst} strokeWidth="2" />
        <circle cx="184" cy="40" r="6" fill={C.amethyst} />
        <circle cx="184" cy="92" r="15" fill="#120d24" stroke={C.amethyst} strokeWidth="2" />
        <path d="M184 82v20M174 92h20" stroke={C.amethyst} strokeWidth="2" strokeLinecap="round" />
      </motion.g>
      {[40, 92].map(y => <g key={y}><rect x="276" y={y - 17} width="40" height="34" rx="9" fill="#120d24" stroke="#3a3358" /><path d={`M286 ${y + 7} a10 10 0 0 1 20 0`} fill="none" stroke={C.mist} strokeWidth="1.6" /><path d={`M296 ${y + 7} l7 -11`} stroke={C.mist} strokeWidth="1.6" strokeLinecap="round" /></g>)}
    </svg>
  );
}

function Quantum({ shots, setShots, noise, setNoise, q, runQ, busy }) {
  const order = ["00", "01", "10", "11"], col = { "00": C.cyan, "11": C.amethyst, "01": C.orchid, "10": C.orchid };
  const err = q ? ((q.counts["01"] + q.counts["10"]) / q.shots) * 100 : 0;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Panel title="Bell state circuit" hint="Two qubits become entangled: measuring one tells you the other. Quantum computers suit specific algorithms, so this is not a speed race with CPUs or GPUs.">
          <Circuit />
        </Panel>
        <Panel title="Experiment settings">
          <div className="flex items-baseline justify-between text-sm"><label htmlFor="shots" className="text-mist">Shots (repeated measurements)</label><b className="font-display">{shots.toLocaleString()}</b></div>
          <input id="shots" type="range" className="range mt-3" style={{ "--p": ((shots - 100) / 4900) * 100 + "%" }} min={100} max={5000} step={100} value={shots} onChange={e => setShots(+e.target.value)} />
          <div className="mt-5 flex items-baseline justify-between text-sm"><label htmlFor="noise" className="text-mist">Noise (chance a bit flips)</label><b className="font-display">{Math.round(noise * 100)}%</b></div>
          <input id="noise" type="range" className="range mt-3" style={{ "--p": (noise / 0.2) * 100 + "%" }} min={0} max={0.2} step={0.01} value={noise} onChange={e => setNoise(+e.target.value)} />
          <button onClick={runQ} disabled={busy} className="btn btn-primary mt-5 w-full"><Icon name="zap" size={16} />{busy ? "Measuring…" : q ? "Run again" : "Run circuit"}</button>
        </Panel>
      </div>
      <Panel title="Measurement results" hint={q ? `${q.shots.toLocaleString()} shots` : undefined} className="self-start">
        {!q ? (
          <div className="grid h-64 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-mist"><div><Icon name="molecule" size={28} className="mx-auto mb-3 text-amethyst" />Run the circuit to see how often<br />each outcome is measured.</div></div>
        ) : (
          <motion.div key={q.counts["00"] + "-" + q.counts["11"] + "-" + q.shots} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={order.map(k => ({ state: `|${k}⟩`, key: k, count: q.counts[k] }))} margin={{ left: -14, right: 6, top: 6 }}>
                  <CartesianGrid stroke="#17141f" vertical={false} /><XAxis dataKey="state" {...axis} /><YAxis {...axis} /><Tooltip content={<Tip />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
                  <Bar dataKey="count" name="Count" radius={[8, 8, 0, 0]}>{order.map(k => <Cell key={k} fill={col[k]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {order.map(k => <div key={k} className="rounded-xl border border-white/[0.07] bg-white/[0.02] py-2"><div className="font-display text-sm font-semibold" style={{ color: col[k] }}>|{k}⟩</div><div className="text-xs text-mist">{((q.counts[k] / q.shots) * 100).toFixed(1)}%</div></div>)}
            </div>
            <p className="mt-4 rounded-2xl bg-amethyst/10 p-3.5 text-xs leading-relaxed text-amethyst-soft">
              {err < 0.5 ? "Only |00⟩ and |11⟩ appear, about half each. The two qubits are correlated, which is the signature of entanglement." : `${err.toFixed(1)}% of results landed on |01⟩ or |10⟩. With no noise these never appear, so every one of them is an error.`}
            </p>
            <p className="mt-3 text-xs text-mist">Statevector [00, 01, 10, 11]: {q.statevector.join(", ")}</p>
          </motion.div>
        )}
      </Panel>
    </div>
  );
}

function History({ hist, cfg, clear, goSim }) {
  const [sure, setSure] = useState(false);
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t); }, [sure]);
  return (
    <Panel title="Saved runs" hint="Stored in SQLite on the backend. The latest 20 are shown."
      right={hist.length > 0 && <button className={`btn btn-ghost !px-3 !py-2 text-xs ${sure ? "!border-orchid/70 !text-orchid" : ""}`} onClick={() => (sure ? (clear(), setSure(false)) : setSure(true))}><Icon name="trash" size={14} />{sure ? "Click again to confirm" : "Clear history"}</button>}>
      {hist.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-14 text-center">
          <Icon name="clock" size={28} className="mb-3 text-amethyst" /><p className="text-sm text-mist">No runs saved yet.</p>
          <button onClick={goSim} className="btn btn-primary mt-4"><Icon name="play" size={15} />Start a simulation</button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs text-mist">{["When", "Task", "Method", "Size", "Time", "Energy"].map(h => <th key={h} className="pb-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {hist.map((h, k) => (
                <motion.tr key={h.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(k, 10) * 0.03 }} className="border-t border-white/[0.06] transition-colors hover:bg-white/[0.03]">
                  <td className="py-3 text-mist">{new Date(h.ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="py-3">{cfg.tasks[h.task]?.name}</td>
                  <td className="py-3"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: PCOLOR[h.paradigm] }} />{cfg.paradigms[h.paradigm]?.name}</td>
                  <td className="py-3">{h.size.toLocaleString()}</td>
                  <td className="py-3 font-semibold">{h.result.total} s</td>
                  <td className="py-3 text-cyan-electric">{h.result.energy_wh} Wh</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ───────────── shell ───────────── */
const Logo = () => (
  <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
    <defs><linearGradient id="lgo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={C.cyan} /><stop offset="1" stopColor={C.amethyst} /></linearGradient></defs>
    <rect x="3" y="3" width="28" height="28" rx="9" fill="#0b0814" stroke="url(#lgo)" strokeWidth="1.6" />
    <rect x="11" y="11" width="12" height="12" rx="3" fill="url(#lgo)" />
    {[10, 17, 24].map(p => <g key={p}><line x1={p} y1="0" x2={p} y2="3" stroke={C.cyan} strokeWidth="1.5" /><line x1={p} y1="31" x2={p} y2="34" stroke={C.amethyst} strokeWidth="1.5" /></g>)}
  </svg>
);

export default function Page() {
  const [cfg, setCfg] = useState(null), [status, setStatus] = useState("loading"), [tab, setTab] = useState("Simulate");
  const [task, setTask] = useState("image"), [size, setSize] = useState(10000), [par, setPar] = useState("hybrid");
  const [run, setRun] = useState(null), [prog, setProg] = useState(0), [playing, setPlaying] = useState(false);
  const [cmp, setCmp] = useState([]), [hist, setHist] = useState([]);
  const [q, setQ] = useState(null), [shots, setShots] = useState(1000), [noise, setNoise] = useState(0), [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null), [pres, setPres] = useState(false);
  const timer = useRef(null);

  const notify = (msg, bad) => { setToast({ msg, bad, id: Date.now() }); };
  const load = useCallback(() => { setStatus("loading"); get("/api/config").then(c => { setCfg(c); setStatus("ready"); }).catch(() => setStatus("offline")); }, []);
  useEffect(load, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    if (tab === "Compare") { setCmp([]); get(`/api/compare?task=${task}&size=${size}`).then(setCmp).catch(() => notify("Could not load the comparison.", true)); }
  }, [tab, task, size]);
  useEffect(() => { if (tab === "History") get("/api/history").then(setHist).catch(() => notify("Could not load history.", true)); }, [tab]);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => setProg(v => { if (v >= 100) { setPlaying(false); return 100; } return v + 1; }), 90);
    return () => clearInterval(timer.current);
  }, [playing]);
  useEffect(() => { if (prog >= 100 && run) notify("Run complete and saved to history."); }, [prog >= 100 && !!run]); // eslint-disable-line

  /* presentation mode: larger type + fullscreen, keys 1-4 switch tabs, P toggles */
  useEffect(() => {
    document.documentElement.style.fontSize = pres ? "112.5%" : "";
    try {
      if (pres && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      if (!pres && document.fullscreenElement) document.exitFullscreen?.();
    } catch {}
  }, [pres]);
  useEffect(() => {
    const fs = () => { if (!document.fullscreenElement) setPres(false); };
    const key = e => {
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key >= "1" && e.key <= "4") setTab(TABS[+e.key - 1][0]);
      if (e.key.toLowerCase() === "p") setPres(v => !v);
    };
    document.addEventListener("fullscreenchange", fs); window.addEventListener("keydown", key);
    return () => { document.removeEventListener("fullscreenchange", fs); window.removeEventListener("keydown", key); };
  }, []);

  if (status !== "ready") return (
    <main className="grid min-h-screen place-items-center p-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="panel w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 w-fit"><Logo /></div>
        {status === "loading" ? <>
          <h1 className="font-display text-xl font-semibold">Connecting to the lab</h1>
          <div className="relative mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-white/10"><span className="absolute inset-y-0 left-0 w-1/2 animate-sweep rounded-full bg-gradient-to-r from-cyan-electric to-amethyst" /></div>
        </> : <>
          <h1 className="font-display text-xl font-semibold">The backend is not running</h1>
          <p className="mt-2 text-sm leading-relaxed text-mist">Hybrid Lab could not reach <span className="text-white">{API}</span>. Start the API in another terminal, then try again.</p>
          <pre className="mt-4 rounded-xl bg-white/[0.04] p-3 text-left text-xs leading-relaxed text-soft">cd backend{"\n"}uvicorn main:app --reload --port 8000</pre>
          <button onClick={load} className="btn btn-primary mt-5 w-full"><Icon name="replay" size={16} />Try again</button>
        </>}
      </motion.div>
    </main>
  );

  const t = cfg.tasks[task];
  const pickTask = k => { setTask(k); setSize(cfg.tasks[k].default); setRun(null); setProg(0); setPlaying(false); };
  const start = async () => {
    try { setRun(await post("/api/simulate", { task, paradigm: par, size })); setProg(0); setPlaying(true); }
    catch { notify("Simulation failed. Check that the backend is running.", true); }
  };
  const runQ = async () => { setBusy(true); try { setQ(await post("/api/quantum", { shots, noise })); } catch { notify("Quantum run failed.", true); } setBusy(false); };
  const clear = () => fetch(API + "/api/history", { method: "DELETE" }).then(() => { setHist([]); notify("History cleared."); }).catch(() => notify("Could not clear history.", true));
  const toggle = () => setPlaying(p => !p);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} className="mb-7 flex flex-wrap items-center gap-4">
        <Logo />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Hybrid Lab</h1>
          <p className="mt-0.5 text-sm text-mist">One task, four ways to compute it.</p>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-mist sm:flex"><i className="h-2 w-2 animate-pulseDot rounded-full bg-mint" />API connected</span>
        <button onClick={() => setPres(v => !v)} className="btn btn-ghost !py-2 text-xs" aria-pressed={pres} title="Press P"><Icon name="expand" size={15} />{pres ? "Exit presentation" : "Present"}</button>
      </motion.header>

      <nav aria-label="Sections" className="relative mb-6 inline-flex max-w-full overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] p-1.5">
        {TABS.map(([n, ic], k) => (
          <button key={n} onClick={() => setTab(n)} aria-current={tab === n ? "page" : undefined} title={`Press ${k + 1}`} className={`relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${tab === n ? "text-white" : "text-mist hover:text-white"}`}>
            {tab === n && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-xl bg-gradient-to-r from-amethyst-deep/80 to-amethyst/70 shadow-[0_0_28px_-6px_rgba(139,92,246,0.9)]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
            <span className="relative flex items-center gap-2"><Icon name={ic} size={16} />{n}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
          {tab === "Simulate" && <Simulate {...{ cfg, task, size, par, setPar, run, prog, playing, start, toggle }} onTask={pickTask} onSize={setSize} />}
          {tab === "Compare" && <Compare {...{ cfg, task, size, cmp }} onTask={k => { setTask(k); setSize(cfg.tasks[k].default); }} onSize={setSize} />}
          {tab === "Quantum" && <Quantum {...{ shots, setShots, noise, setNoise, q, runQ, busy }} />}
          {tab === "History" && <History {...{ hist, cfg, clear }} goSim={() => setTab("Simulate")} />}
        </motion.div>
      </AnimatePresence>

      <p className="mt-10 text-center text-xs text-mist">Educational simulation. Values are illustrative estimates, not hardware benchmarks.</p>

      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} role="status"
            className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border bg-black/90 px-5 py-3 text-sm shadow-2xl backdrop-blur ${toast.bad ? "border-orchid/60 text-orchid" : "border-cyan-electric/40 text-white"}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
