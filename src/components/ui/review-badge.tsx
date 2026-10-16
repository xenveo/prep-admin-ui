import Link from "next/link";
import { cn } from "@/lib/cn";

/** Amber pill, same shape as the band chips: 12px semibold, 3px 9px padding. */
const BASE =
  "inline-flex items-center whitespace-nowrap rounded-full bg-improve-soft px-[9px] py-[3px] text-xs leading-4 font-semibold text-improve-text";

export function ReviewBadge({ count, href, className }: { count: number; href?: string; className?: string }) {
  const text = `${count} to review`;
  if (href) {
    return (
      <Link href={href} className={cn(BASE, "hover:underline", className)}>
        {text}
      </Link>
    );
  }
  return <span className={cn(BASE, className)}>{text}</span>;
}
