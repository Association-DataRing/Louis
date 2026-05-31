"use client";

import { useState } from "react";
import Link from "next/link";
import { IconMenu2 } from "@tabler/icons-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LouisLogo } from "@/components/louis-logo";
import { SidebarContent } from "./sidebar-content";

type Props = {
  user: { name: string; email: string; role: string };
  conversations: {
    id: string;
    title: string;
    projectId: string | null;
    pinnedAt?: Date | null;
  }[];
  projects: { id: string; name: string }[];
};

export function MobileNav({ user, conversations, projects }: Props) {
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
            conversations={conversations}
            projects={projects}
            onNavigate={() => setOpen(false)}
            forceOpen
          />
        </SheetContent>
      </Sheet>
      <Link
        href="/dashboard"
        aria-label="Accueil"
        className="flex items-center gap-2 font-heading text-base tracking-tight"
      >
        <LouisLogo className="size-5 text-primary" />
        Louis
      </Link>
    </div>
  );
}

