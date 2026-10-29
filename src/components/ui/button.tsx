import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Knoppen zijn altijd volledig rond — het merk is in één doorlopende lijn
 * getekend, dus bedieningselementen zijn pillen en alleen de containers zijn
 * zacht afgerond. Ingedrukt zakt de knop 1px, nooit een schaalsprong.
 * `accent` is de teal variant: hooguit één per scherm.
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] active:translate-y-px",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        accent:
          "bg-brand text-brand-foreground hover:bg-brand-hover hover:text-ink-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-transparent hover:border-primary hover:bg-secondary-hover",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline underline-offset-[3px] decoration-brand/70 hover:text-brand-strong hover:decoration-brand",
      },
      // Op een touchscreen minstens 40 px hoog: goed te raken met een duim.
      size: {
        default: "h-9 px-5 py-2 pointer-coarse:h-10",
        sm: "h-8 px-4 text-xs pointer-coarse:h-10",
        lg: "h-11 px-8 text-base",
        icon: "size-9 pointer-coarse:size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
