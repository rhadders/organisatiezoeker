import Image from "next/image";

import { cn } from "@/lib/utils";

/*
 * Het merk komt letterlijk uit de actualisatietool-repo en wordt nooit
 * nagetekend of hertypt. Op een donker vlak staat alleen de duif.
 */
export function Logo({
  variant = "full",
  className,
}: {
  variant?: "full" | "mark";
  className?: string;
}) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/jona-mark.svg"
        alt="Jona"
        width={228}
        height={229}
        className={cn("h-8 w-auto", className)}
      />
    );
  }

  return (
    <Image
      src="/brand/jona-logo-full.svg"
      alt="Jona — zinvolle technologie"
      width={839}
      height={279}
      priority
      className={cn("h-10 w-auto", className)}
    />
  );
}
