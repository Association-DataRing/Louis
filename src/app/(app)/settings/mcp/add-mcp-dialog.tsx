"use client";

import { useState, useTransition } from "react";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createMcpServer } from "./actions";

export function AddMcpDialog() {
  const [open, setOpen] = useState(false);
  const [transport, setTransport] = useState<"sse" | "http">("sse");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createMcpServer(null, formData);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="size-4" />
          Ajouter un serveur MCP
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Ajouter un serveur MCP</DialogTitle>
          <DialogDescription>
            Une fois ajouté, Louis se connecte au serveur pour récupérer
            la liste de ses outils. Les headers (Bearer token, etc.) sont
            chiffrés avant stockage.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Libellé</Label>
            <Input
              id="label"
              name="label"
              required
              maxLength={80}
              placeholder="ex. CRM interne"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transport">Transport</Label>
            <Select
              name="transport"
              value={transport}
              onValueChange={(v) => setTransport(v as "sse" | "http")}
            >
              <SelectTrigger id="transport">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sse">
                  SSE (Server-Sent Events)
                </SelectItem>
                <SelectItem value="http">
                  HTTP Streamable
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL du serveur</Label>
            <Input
              id="url"
              name="url"
              type="url"
              required
              placeholder={
                transport === "sse"
                  ? "https://mon-mcp.cabinet.fr/sse"
                  : "https://mon-mcp.cabinet.fr/mcp"
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="headers">Headers (optionnel)</Label>
            <Input
              id="headers"
              name="headers"
              placeholder='{"Authorization": "Bearer …"}'
              autoComplete="off"
              aria-describedby="headers-help"
            />
            <p id="headers-help" className="text-xs text-muted-foreground">
              Format JSON. Laisser vide si aucune authentification.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
