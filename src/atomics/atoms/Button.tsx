import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/utils/cn";

export function Button({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
