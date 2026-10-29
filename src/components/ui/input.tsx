import * as React from "react";

import { cn } from "@/lib/utils";

const DATE_TYPES = ["date", "time", "datetime-local", "month"];

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-xs transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        "md:text-sm",
        // iOS tekent datum- en tijdvelden in eigen stijl: hoger en breder dan
        // de andere velden, en de waarde gecentreerd. Zonder die eigen stijl
        // volgen ze gewoon de maat van de rest.
        DATE_TYPES.includes(type ?? "") &&
          "min-w-0 appearance-none [&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:text-left",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
