import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-serif-display", subsets: ["latin"] });

const title = "Nexo Assist";
const description = "Service desk de TI da Nexo, numa conversa.";

/** A imagem da prévia vem de opengraph-image.png e twitter-image.png (convenção de arquivos do App Router). */
export const metadata: Metadata = {
  metadataBase: new URL("https://nexo-assist-puce.vercel.app"),
  title,
  description,
  openGraph: { type: "website", locale: "pt_BR", siteName: title, title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
