import Link from "next/link";
import { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "ghost";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-slate-950 text-white hover:bg-slate-800",
  secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-200",
};

export function Button({
  children,
  href,
  type = "button",
  variant = "primary",
}: ButtonProps) {
  const className = `inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-colors ${variants[variant]}`;

  if (href) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={className} type={type}>
      {children}
    </button>
  );
}
