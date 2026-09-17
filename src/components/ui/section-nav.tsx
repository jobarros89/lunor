"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

export type SectionNavItem = {
  key: string;
  href: string;
  label: string;
  icon?: ReactNode;
  active: boolean;
};

/** Navigation links, not ARIA tabs: every item has its own address. */
export function SectionNav({ label, items }: { label: string; items: SectionNavItem[] }) {
  const container = useRef<HTMLElement>(null);
  const activeKey = items.find((item) => item.active)?.key;

  useEffect(() => {
    const nav = container.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const bounds = nav.getBoundingClientRect();
    const itemBounds = active.getBoundingClientRect();
    if (itemBounds.left < bounds.left || itemBounds.right > bounds.right) {
      // Scroll only the module navigation; keep the page at its current position.
      nav.scrollLeft += itemBounds.left - bounds.left - (bounds.width - itemBounds.width) / 2;
    }
  }, [activeKey]);

  return (
    <nav ref={container} className="section-nav" aria-label={label}>
      {items.map((item) => (
        <Link key={item.key} href={item.href} aria-current={item.active ? "page" : undefined} className="section-nav-link">
          {item.icon && <span aria-hidden="true">{item.icon}</span>}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
