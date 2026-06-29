"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateName } from "./actions";

export function NameForm({ initialName }: { initialName: string }) {
  const t = useTranslations("settings.profile");
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateName(null, formData);
      if (result.ok) setSuccess(true);
      else setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t("nameForm.label")}</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{t("toast.nameUpdated")}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={pending || name.trim() === initialName.trim()}
      >
        {pending ? t("nameForm.saving") : t("nameForm.save")}
      </Button>
    </form>
  );
}
