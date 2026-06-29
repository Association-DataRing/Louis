"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleSkill } from "./actions";

interface SkillToggleProps {
  skillId: string;
  enabled: boolean;
  name: string;
}

export function SkillToggle({ skillId, enabled, name }: SkillToggleProps) {
  const router = useRouter();
  const t = useTranslations("settings.skills");
  const [pending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    startTransition(async () => {
      const result = await toggleSkill(skillId, next);
      if (result.ok) {
        router.refresh();
        toast.success(
          next ? t("toast.enabled") : t("toast.disabled"),
          {
            description: name,
          }
        );
      } else {
        toast.error(t("toast.toggleError"), { description: result.error });
      }
    });
  }

  return (
    <Switch
      checked={enabled}
      onCheckedChange={handleChange}
      disabled={pending}
      aria-label={
        enabled
          ? t("toggle.ariaDisable", { name })
          : t("toggle.ariaEnable", { name })
      }
    />
  );
}
