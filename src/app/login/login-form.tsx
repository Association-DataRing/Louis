"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IconArrowLeft, IconLock } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { step: "credentials" };

export function LoginForm() {
  const t = useTranslations("login.form");
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  // `view` = l'étape réellement affichée. On la dérive du retour serveur en
  // ajustant l'état pendant le render (pattern React recommandé plutôt qu'un
  // effet) : à chaque nouveau `state` renvoyé par l'action, on s'aligne sur
  // `state.step`. Comparer l'identité de `state` (et non `state.step`) permet
  // de réavancer même quand le serveur renvoie deux fois "totp". Un retour
  // manuel ("Changer") n'altère pas `state` → il n'est donc pas écrasé.
  const [view, setView] = useState<LoginState["step"]>("credentials");
  const [seenState, setSeenState] = useState(state);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const totpRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  if (state !== seenState) {
    setSeenState(state);
    setView(state.step);
  }

  // Focus le champ code dès qu'on arrive sur l'étape 2.
  useEffect(() => {
    if (view === "totp") totpRef.current?.focus();
  }, [view]);

  const slide = reduce
    ? {}
    : {
        initial: { opacity: 0, x: 16 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -16 },
        transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const },
      };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 space-y-1.5">
        <h1 className="font-heading text-3xl tracking-tight text-foreground">
          {view === "credentials" ? t("titleCredentials") : t("titleTotp")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {view === "credentials"
            ? t("subtitleCredentials")
            : t("subtitleTotp")}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        {/* Pilote l'action serveur ; reflète l'étape affichée. */}
        <input type="hidden" name="step" value={view} />

        <AnimatePresence mode="wait" initial={false}>
          {view === "credentials" ? (
            <motion.div key="credentials" className="space-y-4" {...slide}>
              <div className="space-y-2">
                <Label htmlFor="email">{t("emailLabel")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  className="h-11"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!state.error}
                  aria-describedby={state.error ? "login-error" : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("passwordLabel")}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!state.error}
                  aria-describedby={state.error ? "login-error" : undefined}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div key="totp" className="space-y-4" {...slide}>
              {/* Identifiants validés à l'étape 1, rejoués avec le code. */}
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="password" value={password} />

              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <IconLock
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="truncate text-muted-foreground">{email}</span>
                <button
                  type="button"
                  onClick={() => setView("credentials")}
                  className="-my-2 ml-auto shrink-0 rounded-md px-1 py-2 text-xs font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {t("change")}
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totp">{t("totpLabel")}</Label>
                <Input
                  ref={totpRef}
                  id="totp"
                  name="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  className="h-12 text-center font-mono text-lg tracking-[0.4em] [text-indent:0.2em]"
                  placeholder="000000"
                  aria-invalid={!!state.error}
                  aria-describedby={state.error ? "login-error" : "totp-hint"}
                />
                <p id="totp-hint" className="text-xs text-muted-foreground">
                  {t("totpHint")}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {state.error && (
          <Alert variant="destructive" id="login-error">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full text-sm"
        >
          {pending
            ? t("submitting")
            : view === "credentials"
              ? t("submitCredentials")
              : t("submitTotp")}
        </Button>

        {view === "totp" && (
          <button
            type="button"
            onClick={() => setView("credentials")}
            className="flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <IconArrowLeft aria-hidden className="size-3.5" />
            {t("backToCredentials")}
          </button>
        )}
      </form>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        {t("forgotPassword")}
      </p>
    </div>
  );
}
