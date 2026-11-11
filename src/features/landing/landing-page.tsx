import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/nexo/brand";
import { cn } from "@/lib/utils";
import {
  ANALYST_FEATURES,
  CODE_URL,
  DEMO_HREF,
  HOW_IT_WAS_MADE_URL,
  NAV_LINKS,
  NUMBERS,
  STEPS,
  WHY_ROWS,
} from "./content";
import { HeroScene } from "./hero-scene";
import { LandingNav } from "./landing-nav";
import { ProductShot } from "./product-shot";
import { Reveal } from "./reveal";
import { SHOTS } from "./shots";
import { StepsNav } from "./steps-nav";
import { ShotPair } from "./window-frame";

/**
 * Página de produto do Farol Desk, para quem chega sem sessão em "/".
 * Abre com a cena 3D do farol em tela cheia, que some numa névoa até o claro do app.
 * Só os componentes de movimento (vídeo, inclinação, entrada e passos) rodam no cliente.
 */
export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <a
        href="#conteudo"
        className="sr-only z-[60] rounded-full bg-surface text-sm font-medium text-foreground shadow-lg ring-1 ring-black/10 outline-none focus:not-sr-only focus:fixed focus:top-2 focus:left-3 focus:px-4 focus:py-2.5 focus-visible:ring-2 focus-visible:ring-ring"
      >
        Pular para o conteúdo
      </a>
      {/* Sem JavaScript, nada fica esperando a animação de entrada. */}
      <noscript>
        <style>{"[data-shown='false']{opacity:1!important;translate:none!important;filter:none!important}"}</style>
      </noscript>
      <LandingNav />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Hero />
        <Product />
        <Statement />
        <HowItWorks />
        <Why />
        <Analyst />
        <Numbers />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */

const container = "mx-auto w-full max-w-[1120px] px-5 sm:px-8";
/** Respiro vertical das seções: mais curto no celular, generoso nas telas largas. */
const sectionY = "py-20 sm:py-28 lg:py-36";
const h2 = "font-serif text-[clamp(2.125rem,4.6vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance";
const h3 = "font-serif text-[clamp(1.5rem,2.4vw,1.875rem)] leading-[1.15] font-semibold tracking-[-0.025em] text-balance";
const leadBase = "text-[clamp(1.125rem,1.6vw,1.375rem)] leading-[1.45] tracking-[-0.012em]";
const lead = `${leadBase} text-pretty`;
/** Parágrafo centralizado: linhas equilibradas, sem uma palavra sobrando no fim. */
const leadCenter = `${leadBase} mx-auto text-balance`;
const caption = "mt-5 text-center text-[13px] leading-relaxed text-balance text-muted-foreground";

/**
 * Rótulo de seção. O traço âmbar antes do texto é o feixe do farol em miniatura: aparece no topo
 * e volta em cada seção, como fio condutor.
 */
function Eyebrow({ children, center = false, tone = "primary" }: { children: ReactNode; center?: boolean; tone?: "primary" | "beam" }) {
  return (
    <p
      className={cn(
        "mb-5 flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em]",
        center && "justify-center",
        tone === "beam" ? "text-beam-foreground" : "text-primary",
      )}
    >
      <span aria-hidden="true" className="h-px w-6 bg-beam" />
      {children}
    </p>
  );
}

function ExternalLabel({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ArrowUpRight aria-hidden="true" />
      <span className="sr-only"> (abre em nova aba)</span>
    </>
  );
}

/**
 * Névoa da base do topo: a cena some no cinza claro da página numa curva suave (sem faixa visível),
 * em vez de um corte seco entre o escuro e o claro.
 */
const MIST = `linear-gradient(to bottom, ${[
  [0, 0], [1.3, 8], [4.9, 15.5], [10.4, 22.5], [17.5, 29], [25.9, 35.3], [35.2, 41.2], [45, 47.1],
  [55, 52.9], [64.8, 58.8], [74.1, 64.7], [82.5, 71], [89.6, 77.5], [95.1, 84.5], [98.7, 92], [100, 100],
]
  .map(([alpha, stop]) => `color-mix(in srgb, var(--background) ${alpha}%, transparent) ${stop}%`)
  .join(", ")})`;

/** Azul-índigo das sombras do céu da cena: é a cor dos véus atrás do texto. */
const DUSK = "22 20 44";

const heroPrimary =
  "inline-flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-medium text-[#1d1d1f] transition-colors outline-none hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3b394c] min-[375px]:px-5 sm:px-6 [&_svg]:size-4";
const heroGhost =
  "inline-flex h-12 items-center gap-2 rounded-full border border-white/35 bg-[rgb(22_20_44/0.32)] px-4 text-[15px] font-medium text-white backdrop-blur-md transition-colors outline-none hover:bg-[rgb(22_20_44/0.5)] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3b394c] min-[375px]:px-5 sm:px-6 [&_svg]:size-4";

const heroIn = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-1000 motion-safe:fill-mode-both";

function Hero() {
  return (
    <section
      id="topo"
      aria-labelledby="titulo"
      className="relative isolate flex min-h-[max(100svh,40rem)] flex-col justify-end overflow-hidden bg-[#3b394c] text-white"
    >
      <HeroScene />
      {/* Véus: um no alto, para a barra; um do lado do texto; e a névoa que leva a cena ao claro da página. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-44"
        style={{ background: `linear-gradient(to bottom, rgb(${DUSK} / 0.5), rgb(${DUSK} / 0.18) 55%, transparent)` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [@media(max-aspect-ratio:4/5)]:hidden"
        style={{ background: `linear-gradient(90deg, rgb(${DUSK} / 0.7) 0%, rgb(${DUSK} / 0.56) 30%, rgb(${DUSK} / 0.3) 48%, rgb(${DUSK} / 0.08) 64%, transparent 76%)` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[78%] [@media(max-aspect-ratio:4/5)]:block"
        style={{ background: `linear-gradient(to top, rgb(${DUSK} / 0.82) 22%, rgb(${DUSK} / 0.6) 52%, transparent)` }}
      />
      <div
        aria-hidden="true"
        data-mist=""
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[32%] [@media(max-aspect-ratio:4/5)]:h-[25%]"
        style={{ background: MIST }}
      />

      <div className={cn(container, "relative pt-28 pb-[max(17svh,7.5rem)] sm:pb-[max(21svh,9rem)] lg:pb-[max(24svh,11rem)]")}>
        <div className="max-w-[620px] [opacity:calc(1-var(--hero-p,0)*1.7)] [transform:translate3d(0,calc(var(--hero-p,0)*-7svh),0)]">
          <p className={cn(heroIn, "mb-4 flex items-center gap-2.5 text-[15px] font-medium tracking-[-0.01em] text-white/90")}>
            <span aria-hidden="true" className="h-px w-7 bg-beam" />
            Service desk de TI · protótipo
          </p>
          <h1
            id="titulo"
            className={cn(
              heroIn,
              "font-serif text-[clamp(3.5rem,7.4vw,7rem)] leading-[0.92] font-semibold tracking-[-0.05em] motion-safe:delay-100",
            )}
          >
            Farol Desk
          </h1>
          <p
            className={cn(
              heroIn,
              "mt-6 max-w-[30ch] text-[clamp(1.3125rem,1.9vw,1.75rem)] leading-[1.22] font-medium tracking-[-0.022em] text-balance motion-safe:delay-200",
            )}
          >
            O service desk de TI numa conversa. <span className="text-white/75">Com o porquê de cada decisão à vista.</span>
          </p>
          <div className={cn(heroIn, "mt-9 flex flex-wrap items-center gap-2.5 sm:gap-3 motion-safe:delay-300")}>
            <Link href={DEMO_HREF} className={heroPrimary}>
              Usar a demo
              <ArrowRight aria-hidden="true" />
            </Link>
            <a href={HOW_IT_WAS_MADE_URL} target="_blank" rel="noopener noreferrer" className={heroGhost}>
              <ExternalLabel>Como foi feito</ExternalLabel>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Product() {
  return (
    <section id="produto" aria-labelledby="produto-titulo" className={cn("relative scroll-mt-14 overflow-hidden", sectionY, "pt-16 sm:pt-24 lg:pt-28")}>
      {/* A luz do feixe ainda alcança o começo da página clara: um brilho âmbar bem fraco, do lado do farol.
          O clarão nasce do meio da faixa (não da borda de cima), para não marcar uma linha na emenda com o topo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_46%_50%_at_76%_46%,color-mix(in_oklch,var(--beam)_15%,transparent),transparent_100%)] [@media(max-aspect-ratio:4/5)]:bg-[radial-gradient(ellipse_95%_50%_at_50%_46%,color-mix(in_oklch,var(--beam)_14%,transparent),transparent_100%)]"
      />
      <div className={cn(container, "relative text-center")}>
        <Reveal>
          <Eyebrow center>O produto em ação</Eyebrow>
          <h2 id="produto-titulo" className={h2}>
            Peça ajuda à TI com as suas palavras.
          </h2>
          <p className={cn(leadCenter, "mt-6 max-w-[680px] text-muted-foreground")}>
            <span className="text-foreground">O funcionário descreve o problema.</span> O agent consulta os chamados dele, busca na
            central de ajuda, monta o chamado e só cria depois da confirmação.
          </p>
        </Reveal>
      </div>
      <div className="relative mx-auto mt-12 w-full max-w-[1200px] px-5 sm:mt-16 sm:px-8 lg:mt-20">
        <figure>
          <ProductShot>
            {/* Em telas estreitas a janela inteira ficaria ilegível: entra a mesma conversa no layout de celular do app. */}
            <ShotPair
              from="lg"
              wide={SHOTS.produto}
              wideVariant="window"
              wideSizes="(min-width: 1200px) 1136px, calc(100vw - 4rem)"
              narrow={SHOTS["produto-m"]}
              alt="Tela de atendimento do Farol Desk: Ana conta que o monitor não liga e que tem reunião com cliente às 15h. O Farol responde que o cabo e a tomada já foram conferidos e mostra o rascunho do chamado “Monitor não liga”, com prioridade Alta, esperando confirmação."
            />
          </ProductShot>
          <figcaption className={caption}>Captura do protótipo, com dados fictícios. O rascunho espera o Confirmar da Ana.</figcaption>
        </figure>
      </div>
    </section>
  );
}

function Statement() {
  return (
    <div className="border-y border-border bg-surface py-24 sm:py-32 lg:py-40">
      <div className={cn(container, "text-center")}>
        <Reveal>
          <p className="mx-auto max-w-[920px] font-serif text-[clamp(1.875rem,4.4vw,3.5rem)] leading-[1.08] font-semibold tracking-[-0.035em] text-balance">
            O modelo decide o que fazer.{" "}
            <span className="text-muted-foreground">As regras do service desk ficam em código testado.</span>
          </p>
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-8 max-w-[540px] text-[17px] leading-relaxed text-balance text-muted-foreground">
            Prioridade, prazo, duplicidade e confirmação são funções com teste. Um prompt mal interpretado não quebra uma regra.
          </p>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-titulo" className={cn("scroll-mt-14", sectionY)}>
      <div className={container}>
        <Reveal className="max-w-[720px]">
          <Eyebrow>Como funciona</Eyebrow>
          <h2 id="como-titulo" className={h2}>
            Do problema ao chamado, numa conversa só.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-16 lg:mt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div className="hidden lg:block">
            <StepsNav steps={STEPS.map(({ id, title }) => ({ id, title }))} />
          </div>
          <ol className="space-y-20 sm:space-y-24 lg:space-y-36">
            {STEPS.map((step, index) => (
              <li key={step.id} id={step.id} className="scroll-mt-28">
                <Reveal>
                  <p className="flex items-center gap-3 font-mono text-[13px] text-muted-foreground tabular-nums">
                    <span className="text-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <span aria-hidden="true" className="h-px w-8 bg-border" />
                    <span>{String(STEPS.length).padStart(2, "0")}</span>
                  </p>
                  <h3 className={cn(h3, "mt-4")}>{step.title}</h3>
                  <p className="mt-3 max-w-[540px] text-[17px] leading-relaxed text-pretty text-muted-foreground">{step.text}</p>
                  <ShotPair
                    className="mt-8"
                    wide={SHOTS[step.shot]}
                    narrow={SHOTS[`${step.shot}-m`]}
                    alt={step.alt}
                    wideSizes="(min-width: 1120px) 620px, (min-width: 1024px) 56vw, calc(100vw - 4rem)"
                  />
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function WhyPill() {
  return (
    <span className="inline-flex items-center gap-[0.18em] rounded-full bg-beam-soft px-[0.32em] pb-[0.04em] whitespace-nowrap text-beam-foreground">
      <span aria-hidden="true" className="size-[0.2em] rounded-full bg-beam" />
      por quê?
    </span>
  );
}

function Why() {
  return (
    <section id="por-que" aria-labelledby="por-que-titulo" className={cn("relative scroll-mt-14 overflow-hidden border-y border-border bg-surface", sectionY)}>
      {/* O âmbar do feixe mora aqui: um clarão suave atrás do painel. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[62%] bg-[radial-gradient(ellipse_62%_56%_at_64%_46%,color-mix(in_oklch,var(--beam)_17%,transparent),transparent_70%)] lg:block"
      />
      <div className={cn(container, "relative grid items-center gap-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-20")}>
        <div>
          <Reveal>
            <Eyebrow tone="beam">A assinatura</Eyebrow>
            <h2 id="por-que-titulo" className={h2}>
              Toda resposta tem um <WhyPill />
            </h2>
            <p className={cn(lead, "mt-6 max-w-[560px] text-muted-foreground")}>
              Um toque abre o raciocínio do agent, ali na conversa. Qualquer decisão pode ser conferida na própria tela, pelo
              funcionário ou pelo analista.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <dl className="mt-10 border-t border-border">
              {WHY_ROWS.map((row) => (
                <div key={row.label} className="grid gap-1 border-b border-border py-4 sm:grid-cols-[176px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-[15px] font-semibold tracking-[-0.01em]">{row.label}</dt>
                  <dd className="text-[15px] leading-relaxed text-pretty text-muted-foreground">{row.text}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
        <Reveal delay={150} className="mx-auto w-full max-w-[460px]">
          <figure>
            <ShotPair
              from="lg"
              wide={SHOTS["por-que"]}
              narrow={SHOTS["por-que-m"]}
              wideSizes="460px"
              narrowSizes="(min-width: 500px) 460px, calc(100vw - 2.5rem)"
              narrowMax={460}
              alt="Painel “por quê?” aberto: o agent entendeu que Bruno quer instalar um plugin de IA no Figma, a intenção é tirar uma dúvida, a segurança é de 41%, as ações foram buscar na central e transferir para um analista, a regra de confiança abaixo de 50% duas vezes agiu, e a telemetria mostra o trace, o tempo de cada ferramenta e o raio-X da busca na central."
            />
            <figcaption className={caption}>O painel aberto numa resposta, visto pelo console do analista.</figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Analyst() {
  return (
    <section id="analista" aria-labelledby="analista-titulo" className={cn("scroll-mt-14", sectionY)}>
      <div className={cn(container, "text-center")}>
        <Reveal>
          <Eyebrow center>Do outro lado</Eyebrow>
          <h2 id="analista-titulo" className={h2}>
            O analista atende pelo console.
          </h2>
          <p className={cn(leadCenter, "mt-6 max-w-[640px] text-muted-foreground")}>
            <span className="text-foreground">Vê a fila e assume a conversa com o agent pausado.</span> Depois, devolve ao agent ou
            encerra.
          </p>
        </Reveal>
      </div>

      <Reveal className="mx-auto mt-12 w-full max-w-[1200px] px-5 sm:mt-16 sm:px-8 lg:mt-20">
        <ShotPair
          from="lg"
          wide={SHOTS.console}
          wideVariant="window"
          wideSizes="(min-width: 1200px) 1136px, calc(100vw - 4rem)"
          narrow={SHOTS["console-m"]}
          narrowMax={460}
          narrowSizes="(min-width: 500px) 460px, calc(100vw - 2.5rem)"
          alt="Console do analista com o relatório da conversa do Bruno: o que ele precisa, quando foi transferida e por quê, o que o agent já fez e o que está pendente, ao lado da fila de conversas e dos chamados dele."
          narrowAlt="Relatório da conversa do Bruno no console do analista: o que ele precisa, quando foi transferida e por quê, o que o agent já fez e o que está pendente."
        />
      </Reveal>

      <div className={container}>
        <ul className="mt-12 grid border-t border-border sm:mt-16 md:grid-cols-3 lg:mt-20">
          {ANALYST_FEATURES.map((feature, index) => (
            <li
              key={feature.title}
              className={cn("border-b border-border py-7 md:border-b-0 md:px-8 md:py-10", index === 0 ? "md:pl-0" : "md:border-l", index === 2 && "md:pr-0")}
            >
              <Reveal delay={index * 80}>
                <h3 className="text-[19px] font-semibold tracking-[-0.015em]">{feature.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted-foreground">{feature.text}</p>
              </Reveal>
            </li>
          ))}
        </ul>

        <div className="mt-14 grid items-center gap-10 border-t border-border pt-14 sm:mt-16 sm:pt-16 lg:mt-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16 lg:pt-20">
          <Reveal>
            <h3 className={h3}>Indicadores que não se enganam.</h3>
            <p className="mt-3 max-w-[540px] text-[17px] leading-relaxed text-pretty text-muted-foreground">
              A resolução separa a confirmada da presumida. Não conta chamado aberto nem quem voltou com o mesmo problema.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <ShotPair
              wide={SHOTS.indicadores}
              narrow={SHOTS["indicadores-m"]}
              narrowSizes="300px"
              wideSizes="(min-width: 1120px) 700px, (min-width: 1024px) 62vw, calc(100vw - 4rem)"
              alt="Indicadores do service desk nos últimos 30 dias: resolvido pelo agent, tempo de resposta, “Isso resolveu?”, custo estimado, respostas, confiança média, rascunhos confirmados, sugestões enviadas sem editar e analistas no service desk; abaixo, o quadro “Resolução honesta”, que separa confirmadas, presumidas, reabertas e abandonadas."
              narrowAlt="Indicadores do service desk nos últimos 30 dias: resolvido pelo agent, com confirmadas e presumidas separadas, e tempo de resposta do agent."
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Numbers() {
  return (
    <section id="numeros" aria-labelledby="numeros-titulo" className={cn("scroll-mt-14 border-t border-border bg-surface", sectionY)}>
      <div className={container}>
        <Reveal className="max-w-[720px]">
          <Eyebrow>Provas</Eyebrow>
          <h2 id="numeros-titulo" className={h2}>
            Números, com a fonte.
          </h2>
          <p className={cn(lead, "mt-6 text-muted-foreground")}>
            Os testes rodam sem LLM, a cada push. Os evals usam o modelo real e rodam à mão, porque custam dinheiro.
          </p>
        </Reveal>
        <ul className="mt-12 grid border-t border-border sm:mt-16 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {NUMBERS.map((item, index) => (
            <li
              key={item.value}
              className={cn(
                "flex flex-col border-b border-border py-7 sm:px-6 sm:py-9 lg:border-b-0 lg:py-10",
                index % 2 === 1 && "sm:border-l",
                index % 2 === 0 && "sm:pl-0",
                index > 0 && "lg:border-l lg:pl-6",
                index === 0 && "lg:pl-0",
              )}
            >
              <Reveal delay={index * 80} className="flex h-full flex-col">
                <p className="font-serif text-[clamp(2.75rem,4.6vw,4rem)] leading-none font-semibold tracking-[-0.045em] tabular-nums">
                  {item.value}
                </p>
                <p className="mt-3 max-w-[32ch] text-[15px] leading-snug text-balance text-muted-foreground">{item.caption}</p>
                <p className="mt-auto pt-4">
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[13px] font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5"
                  >
                    <ExternalLabel>{item.source}</ExternalLabel>
                  </a>
                </p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-titulo" className="px-3 py-3 sm:px-5 sm:py-5">
      {/* Fecho: a mesma cena do topo, parada, num cartão. O céu da hora azul volta para o convite final.
          O cartão é alto no celular (quadro vertical) e largo no resto (quadro horizontal). */}
      <div className="relative isolate overflow-hidden rounded-[28px] bg-[#3b394c] text-white sm:rounded-[36px]">
        <picture>
          <source media="(max-width: 639px)" srcSet="/landing/farol-landing-retrato-poster.webp" type="image/webp" />
          <img
            src="/landing/farol-landing-poster.webp"
            alt=""
            width={1600}
            height={900}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 -z-10 size-full object-cover object-[72%_32%] max-sm:object-[50%_18%]"
          />
        </picture>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ background: `linear-gradient(90deg, rgb(${DUSK} / 0.7) 0%, rgb(${DUSK} / 0.5) 40%, rgb(${DUSK} / 0.14) 72%, rgb(${DUSK} / 0.1) 100%)` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 hidden max-sm:block"
          style={{ background: `linear-gradient(to top, rgb(${DUSK} / 0.86) 30%, rgb(${DUSK} / 0.4) 62%, transparent)` }}
        />
        <Reveal className={cn(container, "flex min-h-[30rem] flex-col justify-end py-14 sm:min-h-[34rem] sm:justify-center sm:py-24 max-sm:min-h-[36rem]")}>
          <div className="max-w-[560px]">
            <h2 id="cta-titulo" className={cn(h2, "text-white")}>
              Experimente o Farol Desk.
            </h2>
            <p className={cn(lead, "mt-5 max-w-[34ch] text-balance text-white/85")}>
              Entre como Ana, funcionária, ou Rafael, analista. Um clique, dados fictícios.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-2.5 sm:gap-3">
              <Link href={DEMO_HREF} className={heroPrimary}>
                Usar a demo
                <ArrowRight aria-hidden="true" />
              </Link>
              <a href={CODE_URL} target="_blank" rel="noopener noreferrer" className={heroGhost}>
                <ExternalLabel>Ver o código</ExternalLabel>
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const footerLink =
  "inline-flex items-center gap-1 rounded underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5";

function LandingFooter() {
  return (
    <footer className="bg-background">
      <div className={cn(container, "pt-12 pb-10 text-[13px] text-muted-foreground sm:pt-16")}>
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[440px]">
            <div className="text-foreground">
              <Brand />
            </div>
            <p className="mt-4 leading-relaxed text-pretty">
              Protótipo com dados fictícios. A Nexo é uma empresa fictícia. Na demo, não envie senhas nem dados pessoais.
            </p>
          </div>
          <nav aria-label="Rodapé" className="grid shrink-0 grid-cols-2 gap-x-12 gap-y-8 sm:gap-x-16 md:[&_a]:whitespace-nowrap">
            <div>
              <p className="font-medium text-foreground">Nesta página</p>
              <ul className="mt-3 space-y-2.5">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className={footerLink}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Projeto</p>
              <ul className="mt-3 space-y-2.5">
                <li>
                  <Link href={DEMO_HREF} className={footerLink}>
                    Entrar na demo
                  </Link>
                </li>
                <li>
                  <a href={CODE_URL} target="_blank" rel="noopener noreferrer" className={footerLink}>
                    <ExternalLabel>Código no GitHub</ExternalLabel>
                  </a>
                </li>
                <li>
                  <a href={HOW_IT_WAS_MADE_URL} target="_blank" rel="noopener noreferrer" className={footerLink}>
                    <ExternalLabel>Como foi feito</ExternalLabel>
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <p className="mt-10 border-t border-border pt-6 leading-relaxed text-pretty">
          Cena 3D feita no Blender com assets CC0 da{" "}
          <a href="https://polyhaven.com" target="_blank" rel="noopener noreferrer" className={cn(footerLink, "inline underline")}>
            Poly Haven<span className="sr-only"> (abre em nova aba)</span>
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
