import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed select-none",
          {
            "bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500 active:scale-95":
              variant === "primary",
            "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 focus:ring-zinc-600 active:scale-95":
              variant === "secondary",
            "hover:bg-zinc-800 text-zinc-300 hover:text-white focus:ring-zinc-600 active:scale-95":
              variant === "ghost",
            "bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 focus:ring-red-500 active:scale-95":
              variant === "danger",
            "border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white hover:bg-zinc-800/50 focus:ring-zinc-600 active:scale-95":
              variant === "outline",
          },
          {
            "px-3 py-1.5 text-sm gap-1.5": size === "sm",
            "px-4 py-2 text-sm gap-2": size === "md",
            "px-6 py-3 text-base gap-2": size === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
