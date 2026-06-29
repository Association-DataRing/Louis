"use client";

import { useState, useTransition } from "react";
import { IconShieldCheck, IconShieldLock } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  startTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
} from "./actions";

type Stage =
  | { step: "idle" }
  | { step: "enrolling"; secret: string; uri: string }
  | { step: "done"; backupCodes: string[] };

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const t = useTranslations("settings.security");
  const [pending, start] = useTransition();
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [code, setCode] = useState("");

  function begin() {
    start(async () => {
      try {
        const { secret, uri } = await startTotpEnrollment();
        setStage({ step: "enrolling", secret, uri });
      } catch {
        toast.error(t("toast.startError"));
      }
    });
  }

  function confirm() {
    start(async () => {
      const res = await confirmTotpEnrollment(code);
      if (res.ok) {
        setStage({ step: "done", backupCodes: res.backupCodes });
        setCode("");
        toast.success(t("toast.enabled"));
      } else {
        toast.error(res.error);
      }
    });
  }

  function turnOff() {
    start(async () => {
      try {
        const res = await disableTotp(code);
        if (res.ok) {
          setStage({ step: "idle" });
          setCode("");
          toast.success(t("toast.disabled"));
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error(t("toast.disableError"));
      }
    });
  }

  if (enabled && stage.step !== "done") {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-success">
          <IconShieldCheck className="size-5" />
          <span className="font-medium">{t("twoFactor.enabledTitle")}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("twoFactor.enabledDescription")}
        </p>
        <div className="space-y-2 pt-1">
          <Label htmlFor="totp-disable">
            {t("twoFactor.disableLabel")}
          </Label>
          <Input
            id="totp-disable"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || code.length < 6}
          onClick={turnOff}
        >
          {t("twoFactor.disable")}
        </Button>
      </div>
    );
  }

  if (stage.step === "done") {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-success">
          <IconShieldCheck className="size-5" />
          <span className="font-medium">{t("done.title")}</span>
        </div>
        <p className="text-sm">
          {t.rich("done.backupCodesNotice", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
          {stage.backupCodes.map((c) => (
            <li key={c} className="rounded bg-muted px-2 py-1 text-center">
              {c}
            </li>
          ))}
        </ul>
        <Button size="sm" onClick={() => setStage({ step: "idle" })}>
          {t("done.acknowledge")}
        </Button>
      </div>
    );
  }

  if (stage.step === "enrolling") {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm">
          {t("enrolling.scanInstruction")}
        </p>
        <div className="flex justify-center py-1">
          {/* Fond blanc + bordures quiet zone : scanne aussi en thème sombre. */}
          <div className="rounded-lg bg-white p-3 border border-border">
            <QRCodeSVG value={stage.uri} size={168} level="M" marginSize={0} />
          </div>
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground transition-colors">
            {t("enrolling.manualEntry")}
          </summary>
          <div className="mt-2 rounded bg-muted px-3 py-2 font-mono text-sm break-all text-foreground">
            {stage.secret}
          </div>
        </details>
        <div className="space-y-2 pt-1">
          <Label htmlFor="totp-confirm">{t("enrolling.codeLabel")}</Label>
          <Input
            id="totp-confirm"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={pending || code.length < 6} onClick={confirm}>
            {t("enable")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setStage({ step: "idle" })}
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <IconShieldLock className="size-5" />
        <span className="font-medium">{t("twoFactor.title")}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("twoFactor.description")}
      </p>
      <Button size="sm" disabled={pending} onClick={begin}>
        {t("enable")}
      </Button>
    </div>
  );
}
