import { cn } from "@/lib/utils";

export const CASE_STUDY_URL = "https://skarl007.github.io/nexo-assist/";

/** Para quem chega à demo sem contexto: o estudo de caso do protótipo, em nova aba. */
export function AboutPrototypeLink({ className }: { className?: string }) {
  return (
    <a href={CASE_STUDY_URL} target="_blank" rel="noopener noreferrer" className={cn("whitespace-nowrap text-primary hover:underline", className)}>
      Sobre este protótipo<span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}
