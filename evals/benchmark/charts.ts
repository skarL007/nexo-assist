/**
 * Gráficos do relatório em SVG puro (sem dependências), no formato que o GitHub
 * mostra direto no Markdown. Todos usam o mesmo estilo:
 *
 *   - paleta categórica de referência, na ordem validada para daltonismo
 *     (azul, laranja, verde-água, amarelo); claro e escuro escolhidos por
 *     `prefers-color-scheme`, com fundo próprio (lê bem nos dois temas);
 *   - marcas finas, grade fina e recessiva, texto sempre na cor de texto
 *     (nunca na cor da série), rótulos diretos só onde ajudam;
 *   - cada marca tem <title> (dica ao passar o mouse quando o SVG é aberto
 *     direto). Os números exatos estão nas tabelas de TABELAS.md.
 */

const WIDTH = 760;
const FONT = `font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"`;

/** Tokens de cor por papel; o tema escuro troca os valores num lugar só. */
const STYLE = `<style>
.bg{fill:#fcfcfb}.t1{fill:#0b0b0b}.t2{fill:#52514e}.t3{fill:#898781}
.grid{stroke:#e1e0d9}.axis{stroke:#c3c2b7}.ring{stroke:#fcfcfb}.frame{stroke:rgba(11,11,11,.1)}
.s1{fill:#2a78d6}.s2{fill:#eb6834}.s3{fill:#1baf7a}.s4{fill:#eda100}.mute{fill:#b5b4ad}
.l1{stroke:#2a78d6}.l2{stroke:#eb6834}.lm{stroke:#b5b4ad}
@media (prefers-color-scheme: dark){
.bg{fill:#1a1a19}.t1{fill:#f0efec}.t2{fill:#c3c2b7}.t3{fill:#898781}
.grid{stroke:#2c2c2a}.axis{stroke:#383835}.ring{stroke:#1a1a19}.frame{stroke:rgba(255,255,255,.1)}
.s1{fill:#3987e5}.s2{fill:#d95926}.s3{fill:#199e70}.s4{fill:#c98500}.mute{fill:#5a5955}
.l1{stroke:#3987e5}.l2{stroke:#d95926}.lm{stroke:#5a5955}}
</style>`;

/** Rampa sequencial azul (claro → escuro) para os mapas de calor; igual nos dois temas. */
const RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

const SERIES = ["s1", "s2", "s3", "s4"];

export const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r1 = (n: number) => Math.round(n * 10) / 10;

interface Frame {
  title: string;
  subtitle?: string;
  height: number;
}

function svg({ title, subtitle, height }: Frame, body: string[]): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" ${FONT} role="img" aria-label="${esc(title)}">`,
    STYLE,
    `<title>${esc(title)}</title>`,
    `<rect class="bg frame" x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="8" stroke-width="1"/>`,
    `<text x="20" y="28" font-size="15" font-weight="600" class="t1">${esc(title)}</text>`,
    subtitle ? `<text x="20" y="47" font-size="12" class="t2">${esc(subtitle)}</text>` : "",
    ...body,
    "</svg>",
    "",
  ].join("\n");
}

/** Legenda horizontal: quadradinho na cor da série + texto na cor de texto. */
function legend(items: Array<{ cls: string; label: string; shape?: "dot" | "square" | "line" }>, x: number, y: number): string[] {
  const out: string[] = [];
  let cx = x;
  for (const item of items) {
    if (item.shape === "line") out.push(`<line x1="${cx}" x2="${cx + 14}" y1="${y - 4}" y2="${y - 4}" class="${item.cls.replace("s", "l")}" stroke-width="2"/>`);
    else if (item.shape === "dot") out.push(`<circle cx="${cx + 6}" cy="${y - 4}" r="5" class="${item.cls}"/>`);
    else out.push(`<rect x="${cx}" y="${y - 10}" width="12" height="12" rx="2" class="${item.cls}"/>`);
    out.push(`<text x="${cx + 18}" y="${y}" font-size="12" class="t1">${esc(item.label)}</text>`);
    cx += 18 + item.label.length * 6.6 + 20;
  }
  return out;
}

interface Scale {
  (value: number): number;
  ticks: Array<{ value: number; label: string }>;
}

function linearScale(min: number, max: number, x0: number, x1: number, tickCount: number, format: (v: number) => string): Scale {
  const scale = ((v: number) => x0 + ((v - min) / (max - min || 1)) * (x1 - x0)) as Scale;
  scale.ticks = Array.from({ length: tickCount + 1 }, (_, i) => min + ((max - min) * i) / tickCount).map((value) => ({ value, label: format(value) }));
  return scale;
}

function logScale(min: number, max: number, x0: number, x1: number, format: (v: number) => string): Scale {
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  const scale = ((v: number) => x0 + ((Math.log10(Math.max(v, 10 ** lo)) - lo) / (hi - lo || 1)) * (x1 - x0)) as Scale;
  scale.ticks = Array.from({ length: hi - lo + 1 }, (_, i) => 10 ** (lo + i)).map((value) => ({ value, label: format(value) }));
  return scale;
}

function xAxis(scale: Scale, top: number, bottom: number): string[] {
  return scale.ticks.flatMap((t) => [
    `<line x1="${r1(scale(t.value))}" x2="${r1(scale(t.value))}" y1="${top}" y2="${bottom}" class="grid" stroke-width="1"/>`,
    `<text x="${r1(scale(t.value))}" y="${bottom + 16}" text-anchor="middle" font-size="11" class="t3">${esc(t.label)}</text>`,
  ]);
}

/** Barra horizontal com a ponta do dado arredondada e base reta. */
function bar(x: number, y: number, w: number, h: number, cls: string, tip: string): string {
  const r = Math.min(4, w / 2, h / 2);
  if (w <= 0.5) return "";
  const d = `M${r1(x)},${r1(y)} H${r1(x + w - r)} Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y + r)} V${r1(y + h - r)} Q${r1(x + w)},${r1(y + h)} ${r1(x + w - r)},${r1(y + h)} H${r1(x)} Z`;
  return `<path d="${d}" class="${cls}"><title>${esc(tip)}</title></path>`;
}

const LABEL_X = 220;
const PLOT_RIGHT = WIDTH - 90;

export interface BarRow {
  label: string;
  value: number;
  text: string;
  highlight?: boolean;
}

/** Barras horizontais de uma série; `highlight` pinta a linha em destaque (com legenda). */
export function barChart(o: { title: string; subtitle?: string; rows: BarRow[]; max?: number; log?: boolean; format: (v: number) => string; highlightLabel?: string }): string {
  const top = o.highlightLabel ? 84 : 66;
  const rowH = 30;
  const height = top + o.rows.length * rowH + 44;
  const values = o.rows.map((r) => r.value).filter((v) => v > 0);
  const scale = o.log
    ? logScale(Math.min(...values), Math.max(...values), LABEL_X, PLOT_RIGHT, o.format)
    : linearScale(0, o.max ?? Math.max(...values), LABEL_X, PLOT_RIGHT, 4, o.format);
  const body = [...xAxis(scale, top - 6, top + o.rows.length * rowH)];
  if (o.highlightLabel) body.push(...legend([{ cls: "s2", label: o.highlightLabel }, { cls: "s1", label: "demais modelos" }], 20, 70));
  const x0 = o.log ? scale(scale.ticks[0].value) : LABEL_X;
  o.rows.forEach((row, i) => {
    const y = top + i * rowH + 5;
    const w = Math.max(0, scale(row.value) - x0);
    body.push(`<text x="${LABEL_X - 10}" y="${y + 14}" text-anchor="end" font-size="12" class="t1"${row.highlight ? ' font-weight="600"' : ""}>${esc(row.label)}</text>`);
    body.push(bar(x0, y, w, 20, row.highlight ? "s2" : "s1", `${row.label}: ${row.text}`));
    body.push(`<text x="${r1(x0 + w + 6)}" y="${y + 14}" font-size="12" class="t1">${esc(row.text)}</text>`);
  });
  return svg({ title: o.title, subtitle: o.subtitle, height }, body);
}

export interface GroupRow {
  label: string;
  values: number[];
  texts: string[];
}

/** Barras agrupadas (até 3 séries por linha), com legenda e rótulo no fim de cada barra. */
export function groupedBarChart(o: { title: string; subtitle?: string; series: string[]; rows: GroupRow[]; log?: boolean; format: (v: number) => string }): string {
  const top = 84;
  const barH = 12;
  const rowH = o.series.length * (barH + 2) + 14;
  const height = top + o.rows.length * rowH + 44;
  const values = o.rows.flatMap((r) => r.values).filter((v) => v > 0);
  const scale = o.log
    ? logScale(Math.min(...values), Math.max(...values), LABEL_X, PLOT_RIGHT, o.format)
    : linearScale(0, Math.max(...values), LABEL_X, PLOT_RIGHT, 4, o.format);
  const x0 = o.log ? scale(scale.ticks[0].value) : LABEL_X;
  const body = [...legend(o.series.map((label, j) => ({ cls: SERIES[j], label })), 20, 70), ...xAxis(scale, top - 6, top + o.rows.length * rowH)];
  o.rows.forEach((row, i) => {
    const y = top + i * rowH + 4;
    body.push(`<text x="${LABEL_X - 10}" y="${y + (o.series.length * (barH + 2)) / 2 + 4}" text-anchor="end" font-size="12" class="t1">${esc(row.label)}</text>`);
    row.values.forEach((value, j) => {
      const by = y + j * (barH + 2);
      const w = Math.max(0, scale(value) - x0);
      body.push(bar(x0, by, w, barH, SERIES[j], `${row.label} · ${o.series[j]}: ${row.texts[j]}`));
      body.push(`<text x="${r1(x0 + w + 5)}" y="${by + 10}" font-size="10.5" class="t2">${esc(row.texts[j])}</text>`);
    });
  });
  return svg({ title: o.title, subtitle: o.subtitle, height }, body);
}

export interface RangeRow {
  label: string;
  low: number;
  mid: number;
  high: number;
  text: string;
  highlight?: boolean;
  /** Marcador extra opcional (ex.: tempo até a 1ª palavra). */
  extra?: number;
}

/** Ponto + intervalo: IC de uma taxa, ou latência p50 com faixa até o p95. */
export function rangeChart(o: {
  title: string;
  subtitle?: string;
  rows: RangeRow[];
  domain: [number, number];
  format: (v: number) => string;
  legend: { mid: string; range: string; extra?: string };
}): string {
  const top = 84;
  const rowH = 30;
  const height = top + o.rows.length * rowH + 44;
  // Texto à direita do gráfico ("p50 · p95") precisa de mais espaço que nas barras.
  const plotRight = WIDTH - 150;
  const scale = linearScale(o.domain[0], o.domain[1], LABEL_X, plotRight, 5, o.format);
  const items: Array<{ cls: string; label: string; shape?: "dot" | "square" | "line" }> = [
    { cls: "s1", label: o.legend.mid, shape: "dot" },
    { cls: "s1", label: o.legend.range, shape: "line" },
  ];
  if (o.legend.extra) items.push({ cls: "s3", label: o.legend.extra, shape: "dot" });
  const body = [...legend(items, 20, 70), ...xAxis(scale, top - 6, top + o.rows.length * rowH)];
  o.rows.forEach((row, i) => {
    const cy = top + i * rowH + 15;
    const cls = row.highlight ? "2" : "1";
    body.push(`<text x="${LABEL_X - 10}" y="${cy + 4}" text-anchor="end" font-size="12" class="t1"${row.highlight ? ' font-weight="600"' : ""}>${esc(row.label)}</text>`);
    body.push(`<line x1="${r1(scale(row.low))}" x2="${r1(scale(row.high))}" y1="${cy}" y2="${cy}" class="l${cls}" stroke-width="2" stroke-linecap="round"/>`);
    if (row.extra !== undefined) body.push(`<circle cx="${r1(scale(row.extra))}" cy="${cy}" r="4.5" class="s3 ring" stroke-width="2"><title>${esc(`${row.label}: ${o.legend.extra} ${o.format(row.extra)}`)}</title></circle>`);
    body.push(`<circle cx="${r1(scale(row.mid))}" cy="${cy}" r="6" class="s${cls} ring" stroke-width="2"><title>${esc(`${row.label}: ${row.text}`)}</title></circle>`);
    body.push(`<text x="${plotRight + 12}" y="${cy + 4}" font-size="11.5" class="t2">${esc(row.text)}</text>`);
  });
  return svg({ title: o.title, subtitle: o.subtitle, height }, body);
}

/** Quebra o texto em linhas de até `max` caracteres, sem partir palavras. */
export function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

export interface HeatRow {
  label: string;
  cells: Array<{ value: number | null; text: string }>;
}

/** Mapa de calor (linhas × colunas) na rampa azul; o texto da célula escolhe a cor pelo fundo. */
export function heatmap(o: { title: string; subtitle?: string; columns: string[]; rows: HeatRow[]; domain: [number, number]; legend: [string, string] }): string {
  const labelW = 250;
  const cellW = Math.min(90, (WIDTH - labelW - 20) / o.columns.length);
  // Cabeçalho na horizontal, quebrado em linhas que cabem na coluna (girado colidia com o título).
  const headers = o.columns.map((col) => wrap(col, Math.floor(cellW / 5.6)));
  const lineH = 13;
  const top = Math.max(96, 62 + Math.max(...headers.map((h) => h.length)) * lineH + 8);
  const cellH = 26;
  const height = top + o.rows.length * cellH + 40;
  const body: string[] = [];
  headers.forEach((lines, j) => {
    const cx = labelW + j * cellW + cellW / 2;
    lines.forEach((line, k) => {
      const y = top - 8 - (lines.length - 1 - k) * lineH;
      body.push(`<text x="${r1(cx)}" y="${y}" text-anchor="middle" font-size="10.5" class="t1">${esc(line)}</text>`);
    });
  });
  o.rows.forEach((row, i) => {
    const y = top + i * cellH;
    body.push(`<text x="${labelW - 10}" y="${y + 17}" text-anchor="end" font-size="11.5" class="t1">${esc(row.label)}</text>`);
    row.cells.forEach((cell, j) => {
      const x = labelW + j * cellW;
      if (cell.value === null) {
        body.push(`<rect x="${r1(x + 1)}" y="${y + 1}" width="${r1(cellW - 2)}" height="${cellH - 2}" rx="3" class="mute" opacity="0.35"/>`);
        body.push(`<text x="${r1(x + cellW / 2)}" y="${y + 17}" text-anchor="middle" font-size="11" class="t3">—</text>`);
        return;
      }
      const t = Math.min(1, Math.max(0, (cell.value - o.domain[0]) / (o.domain[1] - o.domain[0] || 1)));
      const step = Math.round(t * (RAMP.length - 1));
      const ink = step >= 3 ? "#ffffff" : "#0b0b0b";
      body.push(`<rect x="${r1(x + 1)}" y="${y + 1}" width="${r1(cellW - 2)}" height="${cellH - 2}" rx="3" fill="${RAMP[step]}"><title>${esc(`${row.label} · ${o.columns[j]}: ${cell.text}`)}</title></rect>`);
      body.push(`<text x="${r1(x + cellW / 2)}" y="${y + 17}" text-anchor="middle" font-size="11" fill="${ink}">${esc(cell.text)}</text>`);
    });
  });
  // Legenda da rampa.
  const ly = 62;
  RAMP.forEach((color, k) => body.push(`<rect x="${20 + k * 22}" y="${ly}" width="20" height="10" rx="2" fill="${color}"/>`));
  body.push(`<text x="20" y="${ly + 24}" font-size="11" class="t3">${esc(o.legend[0])}</text>`);
  body.push(`<text x="${20 + RAMP.length * 22}" y="${ly + 24}" text-anchor="end" font-size="11" class="t3">${esc(o.legend[1])}</text>`);
  return svg({ title: o.title, subtitle: o.subtitle, height }, body);
}

export interface WaterfallStep {
  label: string;
  value: number;
  /** total = barra cheia a partir do zero; delta = degrau (negativo desce). */
  kind: "total" | "delta";
}

/** Cascata: do custo sem cache ao custo pago, degrau por degrau. */
export function waterfall(o: { title: string; subtitle?: string; steps: WaterfallStep[]; format: (v: number) => string }): string {
  const top = 84;
  const rowH = 34;
  const height = top + o.steps.length * rowH + 44;
  let running = 0;
  const spans = o.steps.map((s) => {
    if (s.kind === "total") {
      running = s.value;
      return { ...s, from: 0, to: s.value };
    }
    const from = running;
    running += s.value;
    return { ...s, from: Math.min(from, running), to: Math.max(from, running) };
  });
  const scale = linearScale(0, Math.max(...spans.map((s) => s.to)), LABEL_X, PLOT_RIGHT, 4, o.format);
  const body = [
    ...legend([{ cls: "s1", label: "custo" }, { cls: "s3", label: "economia" }], 20, 70),
    ...xAxis(scale, top - 6, top + o.steps.length * rowH),
  ];
  spans.forEach((s, i) => {
    const y = top + i * rowH + 6;
    const cls = s.kind === "total" ? "s1" : "s3";
    body.push(`<text x="${LABEL_X - 10}" y="${y + 15}" text-anchor="end" font-size="12" class="t1">${esc(s.label)}</text>`);
    body.push(bar(scale(s.from), y, scale(s.to) - scale(s.from), 22, cls, `${s.label}: ${o.format(s.value)}`));
    body.push(`<text x="${r1(scale(s.to) + 6)}" y="${y + 15}" font-size="12" class="t1">${esc(s.kind === "delta" ? `−${o.format(Math.abs(s.value))}` : o.format(s.value))}</text>`);
    if (i < spans.length - 1) {
      const level = s.kind === "total" ? s.to : s.value < 0 ? s.from : s.to;
      body.push(`<line x1="${r1(scale(level))}" x2="${r1(scale(level))}" y1="${y + 22}" y2="${y + rowH}" class="axis" stroke-width="1"/>`);
    }
  });
  return svg({ title: o.title, subtitle: o.subtitle, height }, body);
}

export interface ParetoPoint {
  label: string;
  costUsd: number;
  quality: number;
  onFrontier: boolean;
  highlight?: boolean;
}

/** Qualidade (G-Eval, 1–5) × custo (escala log), com a fronteira de Pareto e o escolhido em destaque. */
export function paretoChart(o: { title: string; subtitle?: string; points: ParetoPoint[]; xLabel: string; format: (v: number) => string }): string {
  const height = 470;
  const m = { top: 92, right: 170, bottom: 56, left: 64 };
  const plotW = WIDTH - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const x = logScale(Math.min(...o.points.map((p) => p.costUsd)), Math.max(...o.points.map((p) => p.costUsd)), m.left, m.left + plotW, o.format);
  const qualities = o.points.map((p) => p.quality);
  const yMin = Math.max(1, Math.floor(Math.min(...qualities) * 2) / 2 - 0.25);
  const yMax = Math.min(5, Math.ceil(Math.max(...qualities) * 2) / 2 + 0.25);
  const y = (q: number) => m.top + (1 - (q - yMin) / (yMax - yMin)) * plotH;

  const body = [
    ...legend(
      [
        { cls: "s2", label: "recomendado", shape: "dot" },
        { cls: "s1", label: "na fronteira de Pareto", shape: "dot" },
        { cls: "mute", label: "dominado", shape: "dot" },
      ],
      20,
      70,
    ),
    ...xAxis(x, m.top, m.top + plotH),
  ];
  for (let q = Math.ceil(yMin * 4) / 4; q <= yMax + 1e-9; q += 0.25) {
    body.push(`<line x1="${m.left}" x2="${m.left + plotW}" y1="${r1(y(q))}" y2="${r1(y(q))}" class="grid" stroke-width="1"/>`);
    body.push(`<text x="${m.left - 8}" y="${r1(y(q) + 4)}" text-anchor="end" font-size="11" class="t3">${q.toFixed(2).replace(".", ",")}</text>`);
  }
  body.push(`<text x="${m.left + plotW / 2}" y="${height - 14}" text-anchor="middle" font-size="12" class="t2">${esc(o.xLabel)}</text>`);
  body.push(`<text x="18" y="${m.top + plotH / 2}" text-anchor="middle" font-size="12" class="t2" transform="rotate(-90 18 ${m.top + plotH / 2})">Qualidade G-Eval (1–5)</text>`);

  const frontier = o.points.filter((p) => p.onFrontier).sort((a, b) => a.costUsd - b.costUsd);
  if (frontier.length > 1) {
    const d = frontier.map((p, i) => `${i ? "L" : "M"}${r1(x(p.costUsd))},${r1(y(p.quality))}`).join(" ");
    body.push(`<path d="${d}" fill="none" class="l1" stroke-width="2" stroke-linejoin="round" opacity="0.5"/>`);
  }
  // Rótulo ao lado do ponto, sem cobrir outro rótulo nem outro ponto: tenta à direita, à esquerda, e desce/sobe.
  const markers = o.points.map((p) => ({ x: x(p.costUsd), y: y(p.quality) }));
  const placed: Array<{ x0: number; x1: number; y: number }> = [];
  const free = (x0: number, x1: number, ly: number) =>
    x0 > 4 &&
    x1 < WIDTH - 8 &&
    !placed.some((l) => Math.abs(l.y - ly) < 14 && x0 < l.x1 && l.x0 < x1) &&
    !markers.some((mk) => mk.x + 9 > x0 && mk.x - 9 < x1 && mk.y + 9 > ly - 10 && mk.y - 9 < ly + 3);
  // Quem importa mais escolhe o lugar do rótulo primeiro: recomendado, fronteira, depois os dominados.
  const rank = (p: ParetoPoint) => (p.highlight ? 0 : p.onFrontier ? 1 : 2);
  for (const p of [...o.points].sort((a, b) => rank(a) - rank(b) || b.quality - a.quality)) {
    const px = x(p.costUsd);
    const py = y(p.quality);
    const cls = p.highlight ? "s2" : p.onFrontier ? "s1" : "mute";
    body.push(`<circle cx="${r1(px)}" cy="${r1(py)}" r="${p.highlight ? 8 : 6}" class="${cls} ring" stroke-width="2"><title>${esc(`${p.label}: qualidade ${p.quality.toFixed(2)} · ${o.format(p.costUsd)}`)}</title></circle>`);
    const w = p.label.length * 6;
    const options = [0, 14, -14, 28, -28, 42].flatMap((dy) => [
      { x0: px + 12, x1: px + 12 + w, y: py + 4 + dy, anchor: "start", tx: px + 12 },
      { x0: px - 12 - w, x1: px - 12, y: py + 4 + dy, anchor: "end", tx: px - 12 },
    ]);
    const spot = options.find((s) => free(s.x0, s.x1, s.y)) ?? options[0];
    placed.push({ x0: spot.x0, x1: spot.x1, y: spot.y });
    body.push(`<text x="${r1(spot.tx)}" y="${r1(spot.y)}" text-anchor="${spot.anchor}" font-size="11.5" class="t1"${p.highlight ? ' font-weight="600"' : ""}>${esc(p.label)}</text>`);
  }
  return svg({ title: o.title, subtitle: o.subtitle, height }, body);
}

export interface CompositeRow {
  label: string;
  /** Contribuição já ponderada de cada dimensão (soma = score composto). */
  parts: { effectiveness: number; quality: number; latency: number; cost: number } | null;
  note?: string;
  highlight?: boolean;
}

const DIMENSIONS = [
  { key: "effectiveness", label: "Efetividade" },
  { key: "quality", label: "Qualidade" },
  { key: "latency", label: "Latência" },
  { key: "cost", label: "Custo" },
] as const;

/** Barras empilhadas: quanto cada dimensão contribui para o score composto (0–1). */
export function compositeChart(o: { title: string; subtitle?: string; rows: CompositeRow[] }): string {
  const top = 84;
  const rowH = 32;
  const height = top + o.rows.length * rowH + 44;
  const scale = linearScale(0, 1, LABEL_X, PLOT_RIGHT, 4, (v) => v.toFixed(2).replace(".", ","));
  const body = [...legend(DIMENSIONS.map((d, j) => ({ cls: SERIES[j], label: d.label })), 20, 70), ...xAxis(scale, top - 6, top + o.rows.length * rowH)];
  o.rows.forEach((row, i) => {
    const y = top + i * rowH + 5;
    body.push(`<text x="${LABEL_X - 10}" y="${y + 15}" text-anchor="end" font-size="12" class="t1"${row.highlight ? ' font-weight="600"' : ""}>${esc(row.label)}</text>`);
    if (!row.parts) {
      body.push(`<text x="${LABEL_X + 4}" y="${y + 15}" font-size="11.5" class="t2">${esc(row.note ?? "sem score")}</text>`);
      return;
    }
    let cursor = LABEL_X;
    let total = 0;
    DIMENSIONS.forEach((d, j) => {
      const value = row.parts![d.key];
      total += value;
      const w = Math.max(0, scale(value) - LABEL_X - 2); // 2px de fundo entre segmentos
      // Só o último segmento tem a ponta arredondada.
      body.push(
        j === DIMENSIONS.length - 1
          ? bar(cursor, y, w, 20, SERIES[j], `${row.label} · ${d.label}: ${value.toFixed(3)}`)
          : `<rect x="${r1(cursor)}" y="${y}" width="${r1(w)}" height="20" class="${SERIES[j]}"><title>${esc(`${row.label} · ${d.label}: ${value.toFixed(3)}`)}</title></rect>`,
      );
      cursor += w + 2;
    });
    body.push(`<text x="${r1(cursor + 4)}" y="${y + 15}" font-size="12" font-weight="600" class="t1">${total.toFixed(3).replace(".", ",")}</text>`);
  });
  return svg({ title: o.title, subtitle: o.subtitle, height }, body);
}
