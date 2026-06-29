"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("settings.mcp");
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
          {t("addDialog.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">{t("addDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("addDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">{t("addDialog.labelField")}</Label>
            <Input
              id="label"
              name="label"
              required
              maxLength={80}
              placeholder={t("addDialog.labelPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transport">{t("addDialog.transport")}</Label>
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
                  {t("addDialog.transportSse")}
                </SelectItem>
                <SelectItem value="http">
                  {t("addDialog.transportHttp")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">{t("addDialog.urlField")}</Label>
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
            <Label htmlFor="headers">{t("addDialog.headersField")}</Label>
            <Input
              id="headers"
              name="headers"
              placeholder='{"Authorization": "Bearer …"}'
              autoComplete="off"
              aria-describedby="headers-help"
            />
            <p id="headers-help" className="text-xs text-muted-foreground">
              {t("addDialog.headersHelp")}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("addDialog.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("addDialog.submitting") : t("addDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
