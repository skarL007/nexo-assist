import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--primary),black_14%)] active:bg-[color-mix(in_oklch,var(--primary),black_22%)]",
        outline:
          "border-border bg-surface text-foreground shadow-xs hover:border-input hover:bg-muted aria-expanded:bg-muted aria-pressed:border-primary/40 aria-pressed:bg-accent aria-pressed:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_7%)] aria-expanded:bg-secondary",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-danger-soft text-danger-foreground hover:bg-[color-mix(in_oklch,var(--danger-soft),var(--danger)_14%)] focus-visible:ring-destructive/40",
        beam: "bg-beam-soft text-beam-foreground hover:bg-beam/60 focus-visible:ring-beam aria-expanded:bg-beam",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-3.5",
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
