import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/brand";
import "./globals.css";

// Inter é a reserva da fonte do sistema da Apple (SF Pro) fora do macOS e do iOS.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = PRODUCT_NAME;
const description = PRODUCT_DESCRIPTION;

/** A imagem da prévia vem de opengraph-image.png e twitter-image.png (convenção de arquivos do App Router). */
export const metadata: Metadata = {
  metadataBase: new URL("https://farol-desk.vercel.app"),
  title,
  description,
  openGraph: { type: "website", locale: "pt_BR", siteName: title, title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
