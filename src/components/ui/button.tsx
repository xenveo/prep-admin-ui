"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";
import { Tooltip } from "./tooltip";

/** `outline` is an alias of `secondary`; `ghost` is the quiet grey text button (Clear, Show as table). */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "secondary-teal"
  | "text"
  | "ghost"
  | "destructive";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  iconLeft?: IconName;
  iconRight?: IconName;
  disabledReason?: string;
};

// Filled buttons go flat grey when disabled (like the design's disabled "Submit flag"); the rest fade.
const FILLED_DISABLED =
  "disabled:bg-neutral-soft disabled:text-ink-faint disabled:filter-none aria-disabled:bg-neutral-soft aria-disabled:text-ink-faint aria-disabled:filter-none";
const FADED_DISABLED = "disabled:opacity-50 aria-disabled:opacity-50";

const OUTLINE = "border border-input-line bg-transparent text-ink font-semibold hover:border-neutral-line";

const VARIANT: Record<ButtonVariant, string> = {
  primary: cn("bg-primary text-on-primary font-bold hover:brightness-110", FILLED_DISABLED),
  secondary: cn(OUTLINE, FADED_DISABLED),
  outline: cn(OUTLINE, FADED_DISABLED),
  "secondary-teal": cn(
    "border border-primary-line bg-transparent text-primary-text font-semibold hover:bg-primary-tint",
    FADED_DISABLED,
  ),
  text: cn("bg-transparent text-primary-text font-semibold hover:bg-primary-tint", FADED_DISABLED),
  ghost: cn("bg-transparent text-ink-muted font-semibold hover:bg-row-hover hover:text-ink", FADED_DISABLED),
  destructive: cn("bg-error text-on-error font-bold hover:brightness-110", FILLED_DISABLED),
};

/** Min 44px hit area through an invisible pseudo-element; visual height stays 40px / 32px. */
export function buttonClasses(variant: ButtonVariant = "secondary", size: "md" | "sm" = "md", className?: string) {
  return cn(
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-[filter,background-color,border-color,color] duration-100",
    "after:absolute after:inset-x-0 after:content-['']",
    size === "md"
      ? "h-10 rounded-[10px] px-4 text-sm after:-inset-y-0.5"
      : "h-8 rounded-lg px-3 text-[13px] after:-inset-y-1.5",
    VARIANT[variant],
    "aria-disabled:cursor-not-allowed disabled:cursor-not-allowed",
    className,
  );
}

const ICON_SIZE = 16;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", iconLeft, iconRight, disabledReason, className, children, onClick, type, ...rest },
  ref,
) {
  const blocked = Boolean(disabledReason);
  const button = (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-disabled={blocked || undefined}
      {...rest}
      onClick={(e) => {
        if (blocked) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={buttonClasses(variant, size, className)}
    >
      {iconLeft ? <Icon name={iconLeft} size={ICON_SIZE} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={ICON_SIZE} /> : null}
    </button>
  );
  if (!blocked) return button;
  return <Tooltip content={disabledReason}>{button}</Tooltip>;
});

export function ButtonLink({
  variant = "secondary",
  size = "md",
  iconLeft,
  iconRight,
  disabledReason,
  disabled,
  className,
  children,
  href,
  ...rest
}: Omit<ButtonProps, "type"> & { href: string }) {
  const content = (
    <>
      {iconLeft ? <Icon name={iconLeft} size={ICON_SIZE} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={ICON_SIZE} /> : null}
    </>
  );
  if (disabled || disabledReason) {
    const el = (
      <span role="link" aria-disabled="true" tabIndex={0} className={buttonClasses(variant, size, className)}>
        {content}
      </span>
    );
    return disabledReason ? <Tooltip content={disabledReason}>{el}</Tooltip> : el;
  }
  const anchorProps = rest as unknown as Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;
  return (
    <Link href={href} {...anchorProps} className={buttonClasses(variant, size, className)}>
      {content}
    </Link>
  );
}
