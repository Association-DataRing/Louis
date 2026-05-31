"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LouisLogo } from "@/components/louis-logo";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-foreground">
          <LouisLogo className="size-6 text-primary" />
          <span className="font-heading text-lg tracking-tight">Louis</span>
        </Link>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="font-heading text-2xl">Connexion</CardTitle>
            <CardDescription>
              Accédez à votre instance Louis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="vous@cabinet.fr"
                  aria-invalid={!!state.error}
                  aria-describedby={state.error ? "login-error" : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  aria-invalid={!!state.error}
                  aria-describedby={state.error ? "login-error" : undefined}
                />
              </div>

              {state.error && (
                <Alert variant="destructive" id="login-error">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Mot de passe oublié ? Contactez l&apos;administrateur de votre
              cabinet.
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Pas encore d&apos;instance ?{" "}
          <Link href="/" className="underline-offset-2 hover:underline">
            Découvrir Louis
          </Link>
        </p>
      </div>
    </main>
  );
}

