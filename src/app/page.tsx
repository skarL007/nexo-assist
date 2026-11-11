import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { HERO_SKY } from "@/features/landing/content";
import { LandingPage } from "@/features/landing/landing-page";
import { PRODUCT_NAME } from "@/lib/brand";
import { currentUser, homeFor } from "@/server/session";

const title = "Farol Desk · service desk de TI numa conversa";
const description =
  "Protótipo de agent de service desk de TI: o funcionário descreve o problema, o agent consulta, monta o chamado e só cria depois da confirmação, e cada resposta mostra o porquê.";
/** Prévia de link da página do produto: o topo com o farol, em 1200 × 630. */
const preview = {
  url: "/landing/og.jpg",
  width: 1200,
  height: 630,
  alt: "Farol Desk: o service desk de TI numa conversa. Um farol num penhasco ao anoitecer, com o feixe âmbar aceso.",
};

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "pt_BR", siteName: PRODUCT_NAME, url: "/", title, description, images: [preview] },
  twitter: { card: "summary_large_image", title, description, images: [preview] },
};

/** A barra do navegador do celular começa na cor do céu do topo; a landing troca para o claro ao rolar. */
export const viewport: Viewport = { themeColor: HERO_SKY };

/** Quem tem sessão vai para a sua área; quem chega sem sessão vê a página do produto. */
export default async function Home() {
  const user = await currentUser();
  if (user) redirect(homeFor(user.role));
  return <LandingPage />;
}
