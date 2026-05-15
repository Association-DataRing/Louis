"use client";

import { useTransition } from "react";
import { IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { importDefaultWorkflows } from "./actions";

export function ImportDefaultsButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      onClick={() => startTransition(() => importDefaultWorkflows())}
      disabled={pending}
    >
      <IconDownload className="size-4" />
      {pending ? "Import…" : "Importer la bibliothèque suggérée"}
    </Button>
  );
}
