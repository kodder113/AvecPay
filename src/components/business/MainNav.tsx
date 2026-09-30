"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  /** Visual break before this item. */
  divider?: boolean;
}

/** Second header row; highlights the current section. */
export function MainNav({ items, signOut }: { items: NavItem[]; signOut: string }) {
  const path = usePathname();
  // The most specific matching link is the active one (/cobrar vs /cobrar/panel).
  const active = items
    .filter((i) => path === i.href || path.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <div className="mx-auto flex max-w-3xl items-center gap-5 overflow-x-auto whitespace-nowrap px-4 pb-3 text-sm font-medium print:hidden">
      {items.map((i) => (
        <span key={i.href} className="flex items-center gap-5">
          {i.divider && <span className="h-4 w-px bg-white/20" />}
          <Link href={i.href} className={i.href === active ? "font-semibold text-brand-yellow" : "text-slate-200 hover:text-brand-yellow"}>
            {i.label}
          </Link>
        </span>
      ))}
      <form action="/auth/signout" method="post" className="ml-auto pl-2">
        <button className="text-slate-400 hover:text-white">{signOut}</button>
      </form>
    </div>
  );
}
