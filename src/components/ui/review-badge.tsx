import Link from "next/link";
import { cn } from "@/lib/cn";

const BASE =
  "inline-flex h-5 items-center whitespace-nowrap rounded-full border border-dashed border-improve bg-improve-soft px-2 text-xs font-semibold text-ai-text";

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
