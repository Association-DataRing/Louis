"use client";

import { useState } from "react";
import Link from "next/link";
import { IconMenu2 } from "@tabler/icons-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar-content";

type Props = {
  user: { name: string; email: string; role: string };
};

export function MobileNav({ user }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-4 py-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="inline-flex items-center justify-center size-9 rounded-md hover:bg-accent transition-colors"
          aria-label="Ouvrir la navigation"
        >
          <IconMenu2 className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation Louis</SheetTitle>
          <SidebarContent
            user={user}
            onNavigate={() => setOpen(false)}
            forceOpen
          />
        </SheetContent>
      </Sheet>
      <Link
        href="/dashboard"
        className="flex items-center gap-2 font-heading text-base tracking-tight"
      >
        <OakLogo className="size-5 text-primary" />
        Louis
      </Link>
    </div>
  );
}

function OakLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 21V13" />
      <path d="M9 21h6" />
      <path d="M12 13c0-3 2-4 4-4 1.5 0 3-1 3-3 0-1.5-1-3-3-3-1.5 0-2.5 1-3 2-.5-1-1.5-2-3-2-2 0-3 1.5-3 3 0 2 1.5 3 3 3 2 0 4 1 4 4Z" />
    </svg>
  );
}
