"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";
import { Tooltip } from "./tooltip";

export type ButtonVariant = "primary" | "secondary" | "secondary-teal" | "text" | "destructive";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  iconLeft?: IconName;
  iconRight?: IconName;
  disabledReason?: string;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary font-semibold hover:brightness-95",
  secondary: "border border-line bg-surface text-ink font-medium hover:bg-row-hover",
  "secondary-teal":
    "border border-primary bg-surface text-primary-text font-semibold hover:bg-primary-tint",
  text: "bg-transparent text-primary-text font-semibold hover:bg-primary-tint",
  destructive: "bg-error text-on-error font-semibold hover:brightness-95",
};

/** Min 44px hit area through an invisible pseudo-element; visual height stays 36px / 32px. */
export function buttonClasses(variant: ButtonVariant = "secondary", size: "md" | "sm" = "md", className?: string) {
  return cn(
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md transition-[filter,background-color] duration-100",
    "after:absolute after:inset-x-0 after:content-['']",
    size === "md" ? "h-9 px-4 text-sm after:-inset-y-1" : "h-8 px-3 text-[13px] after:-inset-y-1.5",
    VARIANT[variant],
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50",
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
