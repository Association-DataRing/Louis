"use client";

import { useState, useTransition } from "react";
import { IconShieldCheck, IconShieldLock } from "@tabler/icons-react";
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
  const [pending, start] = useTransition();
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [code, setCode] = useState("");

  function begin() {
    start(async () => {
      try {
        const { secret, uri } = await startTotpEnrollment();
        setStage({ step: "enrolling", secret, uri });
      } catch {
        toast.error("Impossible de démarrer l'enrôlement.");
      }
    });
  }

  function confirm() {
    start(async () => {
      const res = await confirmTotpEnrollment(code);
      if (res.ok) {
        setStage({ step: "done", backupCodes: res.backupCodes });
        setCode("");
        toast.success("2FA activée.");
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
          toast.success("2FA désactivée.");
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("Impossible de désactiver la 2FA.");
      }
    });
  }

  if (enabled && stage.step !== "done") {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-success">
          <IconShieldCheck className="size-5" />
          <span className="font-medium">Authentification à deux facteurs activée</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Un code à 6 chiffres vous sera demandé à chaque connexion.
        </p>
        <div className="space-y-2 pt-1">
          <Label htmlFor="totp-disable">
            Saisissez un code 2FA actuel pour désactiver
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
          Désactiver la 2FA
        </Button>
      </div>
    );
  }

  if (stage.step === "done") {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-success">
          <IconShieldCheck className="size-5" />
          <span className="font-medium">2FA activée</span>
        </div>
        <p className="text-sm">
          Conservez ces <strong>codes de secours</strong> en lieu sûr : ils
          permettent de vous connecter si vous perdez votre téléphone. Chacun
          n&apos;est utilisable qu&apos;une fois.{" "}
          <strong>Ils ne seront plus jamais affichés.</strong>
        </p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
          {stage.backupCodes.map((c) => (
            <li key={c} className="rounded bg-muted px-2 py-1 text-center">
              {c}
            </li>
          ))}
        </ul>
        <Button size="sm" onClick={() => setStage({ step: "idle" })}>
          J&apos;ai noté mes codes
        </Button>
      </div>
    );
  }

  if (stage.step === "enrolling") {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm">
          Scannez ce QR code avec votre application d&apos;authentification
          (Google Authenticator, Aegis, 1Password…).
        </p>
        <div className="flex justify-center py-1">
          {/* Fond blanc + bordures quiet zone : scanne aussi en thème sombre. */}
          <div className="rounded-lg bg-white p-3 border border-border">
            <QRCodeSVG value={stage.uri} size={168} level="M" marginSize={0} />
          </div>
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground transition-colors">
            Impossible de scanner ? Saisie manuelle
          </summary>
          <div className="mt-2 rounded bg-muted px-3 py-2 font-mono text-sm break-all text-foreground">
            {stage.secret}
          </div>
        </details>
        <div className="space-y-2 pt-1">
          <Label htmlFor="totp-confirm">Code à 6 chiffres généré par l&apos;app</Label>
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
            Activer la 2FA
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setStage({ step: "idle" })}
          >
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <IconShieldLock className="size-5" />
        <span className="font-medium">Authentification à deux facteurs</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Renforcez la sécurité de votre compte avec un code temporaire (TOTP) en
        plus de votre mot de passe. Recommandé surtout pour les comptes
        administrateur.
      </p>
      <Button size="sm" disabled={pending} onClick={begin}>
        Activer la 2FA
      </Button>
    </div>
  );
}
