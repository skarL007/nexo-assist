import { CASE_STUDY_URL } from "@/lib/brand";
import { cn } from "@/lib/utils";

export { CASE_STUDY_URL };

/** Para quem chega à demo sem contexto: o estudo de caso do protótipo, em nova aba. */
export function AboutPrototypeLink({ className }: { className?: string }) {
  return (
    <a href={CASE_STUDY_URL} target="_blank" rel="noopener noreferrer" className={cn("rounded font-medium whitespace-nowrap text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/70", className)}>
      Sobre este protótipo<span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}
