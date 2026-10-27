/**
 * Gráficos do relatório em SVG puro (sem dependências). Fundo claro explícito para
 * ler igual no tema claro e escuro do GitHub; cada marca tem <title> (dica ao passar
 * o mouse quando o SVG é aberto direto). Os números exatos estão nas tabelas.
 */

const COLORS = {
  surface: "#fcfcfb",
  text: "#0b0b0b",
  textSecondary: "#52514e",
  grid: "#e6e5e1",
  muted: "#a3a29c",
  // Paleta categórica de referência, na ordem validada para daltonismo.
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"],
};
const FONT = "font-family=\"system-ui, -apple-system, 'Segoe UI', sans-serif\"";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface ParetoPoint {
  label: string;
  costUsd: number;
  quality: number;
  onFrontier: boolean;
}

/** Qualidade (G-Eval, 1–5) × custo por atendimento (escala log). */
export function paretoChart(points: ParetoPoint[]): string {
  const width = 760;
  const height = 440;
  const m = { top: 56, right: 150, bottom: 52, left: 56 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;

  const logs = points.map((p) => Math.log10(p.costUsd));
  const xMin = Math.floor(Math.min(...logs));
  const xMax = Math.ceil(Math.max(...logs));
  const yMin = Math.max(1, Math.floor(Math.min(...points.map((p) => p.quality)) * 2) / 2 - 0.5);
  const yMax = 5;
  const x = (usd: number) => m.left + ((Math.log10(usd) - xMin) / (xMax - xMin || 1)) * plotW;
  const y = (q: number) => m.top + (1 - (q - yMin) / (yMax - yMin)) * plotH;

  const parts: string[] = [];
  // Grade e eixos (finos, recessivos).
  for (let e = xMin; e <= xMax; e++) {
    const px = x(10 ** e);
    parts.push(`<line x1="${px}" x2="${px}" y1="${m.top}" y2="${m.top + plotH}" stroke="${COLORS.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${px}" y="${m.top + plotH + 18}" text-anchor="middle" font-size="11" fill="${COLORS.textSecondary}">US$ ${(10 ** e).toString()}</text>`);
  }
  for (let q = Math.ceil(yMin * 2) / 2; q <= yMax; q += 0.5) {
    const py = y(q);
    parts.push(`<line x1="${m.left}" x2="${m.left + plotW}" y1="${py}" y2="${py}" stroke="${COLORS.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${m.left - 8}" y="${py + 4}" text-anchor="end" font-size="11" fill="${COLORS.textSecondary}">${q.toFixed(1)}</text>`);
  }
  parts.push(`<text x="${m.left + plotW / 2}" y="${height - 12}" text-anchor="middle" font-size="12" fill="${COLORS.textSecondary}">Custo por atendimento (escala log) — mais à esquerda é mais barato</text>`);
  parts.push(`<text x="16" y="${m.top + plotH / 2}" text-anchor="middle" font-size="12" fill="${COLORS.textSecondary}" transform="rotate(-90 16 ${m.top + plotH / 2})">Qualidade G-Eval (1–5)</text>`);

  // Fronteira: liga os pontos não dominados, do mais barato ao mais caro.
  const frontier = points.filter((p) => p.onFrontier).sort((a, b) => a.costUsd - b.costUsd);
  if (frontier.length > 1) {
    const path = frontier.map((p, i) => `${i ? "L" : "M"}${x(p.costUsd).toFixed(1)},${y(p.quality).toFixed(1)}`).join(" ");
    parts.push(`<path d="${path}" fill="none" stroke="${COLORS.series[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.6"/>`);
  }

  // Pontos com anel na cor do fundo e rótulo ao lado (desvia de rótulos já colocados).
  const placed: Array<{ x: number; y: number; w: number }> = [];
  for (const p of [...points].sort((a, b) => b.quality - a.quality)) {
    const px = x(p.costUsd);
    const py = y(p.quality);
    const color = p.onFrontier ? COLORS.series[0] : COLORS.muted;
    parts.push(
      `<circle cx="${px}" cy="${py}" r="6" fill="${color}" stroke="${COLORS.surface}" stroke-width="2"><title>${escape(p.label)}: qualidade ${p.quality.toFixed(2)} · US$ ${p.costUsd.toFixed(4)} por atendimento</title></circle>`,
    );
    const w = p.label.length * 6.4;
    let ly = py + 4;
    for (let tries = 0; tries < 6 && placed.some((l) => Math.abs(l.y - ly) < 14 && px + 10 < l.x + l.w && l.x < px + 10 + w); tries++) ly += 14;
    placed.push({ x: px + 10, y: ly, w });
    parts.push(`<text x="${px + 10}" y="${ly}" font-size="11.5" fill="${COLORS.text}">${escape(p.label)}</text>`);
  }

  const legend = [
    `<circle cx="${m.left + 6}" cy="30" r="5" fill="${COLORS.series[0]}"/><text x="${m.left + 16}" y="34" font-size="12" fill="${COLORS.text}">Fronteira de Pareto (ninguém é mais barato e melhor ao mesmo tempo)</text>`,
    `<circle cx="${m.left + 446}" cy="30" r="5" fill="${COLORS.muted}"/><text x="${m.left + 456}" y="34" font-size="12" fill="${COLORS.text}">Dominado</text>`,
  ];
  return svg(width, height, "Qualidade × custo por atendimento", [...legend, ...parts]);
}

export interface CompositeRow {
  label: string;
  /** Contribuição já ponderada de cada dimensão (soma = score composto). */
  parts: { effectiveness: number; quality: number; latency: number; cost: number } | null;
  note?: string;
}

const DIMENSIONS = [
  { key: "effectiveness", label: "Efetividade" },
  { key: "quality", label: "Qualidade" },
  { key: "latency", label: "Latência" },
  { key: "cost", label: "Custo" },
] as const;

/** Barras empilhadas: quanto cada dimensão contribui para o score composto (0–1). */
export function compositeChart(rows: CompositeRow[]): string {
  const width = 760;
  const rowH = 34;
  const m = { top: 64, right: 70, bottom: 36, left: 230 };
  const height = m.top + rows.length * rowH + m.bottom;
  const plotW = width - m.left - m.right;
  const x = (v: number) => (v * plotW);

  const parts: string[] = [];
  for (let t = 0; t <= 1.0001; t += 0.25) {
    const px = m.left + x(t);
    parts.push(`<line x1="${px}" x2="${px}" y1="${m.top - 6}" y2="${height - m.bottom}" stroke="${COLORS.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${px}" y="${height - m.bottom + 16}" text-anchor="middle" font-size="11" fill="${COLORS.textSecondary}">${t.toFixed(2)}</text>`);
  }

  rows.forEach((row, i) => {
    const cy = m.top + i * rowH + rowH / 2;
    parts.push(`<text x="${m.left - 10}" y="${cy + 4}" text-anchor="end" font-size="12" fill="${COLORS.text}">${escape(row.label)}</text>`);
    if (!row.parts) {
      parts.push(`<text x="${m.left + 4}" y="${cy + 4}" font-size="11.5" fill="${COLORS.textSecondary}">${escape(row.note ?? "sem score")}</text>`);
      return;
    }
    let cursor = m.left;
    const total = DIMENSIONS.reduce((sum, d) => sum + row.parts![d.key], 0);
    DIMENSIONS.forEach((d, j) => {
      const w = Math.max(0, x(row.parts![d.key]) - 2); // 2px de fundo entre segmentos
      const last = j === DIMENSIONS.length - 1;
      const r = last ? 4 : 0;
      parts.push(
        `<path d="${roundedEnd(cursor, cy - 11, w, 22, r)}" fill="${COLORS.series[j]}"><title>${escape(row.label)} · ${d.label}: ${row.parts![d.key].toFixed(3)}</title></path>`,
      );
      cursor += w + 2;
    });
    parts.push(`<text x="${cursor + 6}" y="${cy + 4}" font-size="12" font-weight="600" fill="${COLORS.text}">${total.toFixed(3)}</text>`);
  });

  let lx = m.left;
  DIMENSIONS.forEach((d, j) => {
    parts.push(`<rect x="${lx}" y="24" width="12" height="12" rx="2" fill="${COLORS.series[j]}"/>`);
    parts.push(`<text x="${lx + 18}" y="34" font-size="12" fill="${COLORS.text}">${d.label}</text>`);
    lx += 18 + d.label.length * 7 + 22;
  });
  return svg(width, height, "Score composto por dimensão", parts);
}

/** Retângulo com o canto direito arredondado (ponta do dado) e base reta. */
function roundedEnd(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2);
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
}

function svg(width: number, height: number, title: string, body: string[]): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ${FONT} role="img" aria-label="${escape(title)}">`,
    `<title>${escape(title)}</title>`,
    `<rect width="${width}" height="${height}" fill="${COLORS.surface}"/>`,
    ...body,
    "</svg>",
    "",
  ].join("\n");
}
