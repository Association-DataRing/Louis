"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-foreground">
          <OakLogo className="size-6 text-primary" />
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
                />
              </div>

              {state.error && (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
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

function OakLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 21V13" />
      <path d="M9 21h6" />
      <path d="M12 13c0-3 2-4 4-4 1.5 0 3-1 3-3 0-1.5-1-3-3-3-1.5 0-2.5 1-3 2-.5-1-1.5-2-3-2-2 0-3 1.5-3 3 0 2 1.5 3 3 3 2 0 4 1 4 4Z" />
    </svg>
  );
}
