"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconPlus, IconTrash } from "@tabler/icons-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PROVIDER_CATALOG,
  type ProviderType,
} from "@/lib/providers/catalog";
import { MODEL_CATALOG, DEFAULT_MODEL } from "@/lib/providers/models";
import { createTabularReview } from "../actions";

type KeyOption = { id: string; label: string; type: ProviderType };
type DocOption = { id: string; filename: string };

type Column = { id: string; label: string; prompt: string };

const DEFAULT_COLUMNS: Column[] = [
  {
    id: crypto.randomUUID(),
    label: "Type de document",
    prompt:
      "Nature du document : contrat, mémo, décision, courrier, autre. Sois précis.",
  },
  {
    id: crypto.randomUUID(),
    label: "Date principale",
    prompt:
      "Date la plus importante du document (signature, décision, etc.). Format JJ/MM/AAAA.",
  },
];

export function NewReviewForm({
  providerKeys,
  documents,
}: {
  providerKeys: KeyOption[];
  documents: DocOption[];
}) {
  const router = useRouter();
  const t = useTranslations("tabularReviews");
  const [name, setName] = useState("");
  const [providerKeyId, setProviderKeyId] = useState(providerKeys[0].id);
  const initialType = providerKeys[0].type;
  const [modelId, setModelId] = useState(DEFAULT_MODEL[initialType]);
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeProvider(nextId: string) {
    setProviderKeyId(nextId);
    const next = providerKeys.find((k) => k.id === nextId);
    if (next) setModelId(DEFAULT_MODEL[next.type]);
  }

  function updateColumn(i: number, patch: Partial<Column>) {
    setColumns((cols) =>
      cols.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    );
  }
  function removeColumn(i: number) {
    setColumns((cols) => cols.filter((_, idx) => idx !== i));
  }
  function addColumn() {
    setColumns((cols) => [
      ...cols,
      { id: crypto.randomUUID(), label: "", prompt: "" },
    ]);
  }

  function toggleDoc(id: string) {
    setSelectedDocs((d) =>
      d.includes(id) ? d.filter((x) => x !== id) : [...d, id]
    );
  }

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError(t("form.errorName"));
      return;
    }
    if (columns.length === 0) {
      setError(t("form.errorColumnRequired"));
      return;
    }
    for (const c of columns) {
      if (!c.label.trim() || !c.prompt.trim()) {
        setError(t("form.errorColumnFields"));
        return;
      }
    }

    startTransition(async () => {
      const result = await createTabularReview({
        name: name.trim(),
        providerKeyId,
        modelId,
        columns: columns.map((c) => ({
          label: c.label.trim(),
          prompt: c.prompt.trim(),
        })),
        documentIds: selectedDocs,
      });
      if (result.ok && result.id) {
        router.push(`/tabular-reviews/${result.id}`);
      } else if (!result.ok) {
        setError(result.error);
      }
    });
  }

  const selectedType =
    providerKeys.find((k) => k.id === providerKeyId)?.type ?? "mistral";
  const modelOptions = MODEL_CATALOG[selectedType];

  return (
    <div className="space-y-8">
      {/* Nom */}
      <section className="space-y-2">
        <Label htmlFor="name">{t("form.nameLabel")}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("form.namePlaceholder")}
          maxLength={120}
        />
      </section>

      {/* Provider + modèle */}
      <section className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("form.providerLabel")}</Label>
          <Select
            value={providerKeyId}
            onValueChange={changeProvider}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerKeys.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.label}{" "}
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {PROVIDER_CATALOG[k.type].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("form.modelLabel")}</Label>
          <Select
            value={modelId}
            onValueChange={setModelId}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                  {m.hint && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      · {m.hint}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Colonnes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg tracking-tight">{t("form.columnsHeading")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("form.columnsHint")}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addColumn}>
            <IconPlus className="size-3.5" />
            {t("form.addColumn")}
          </Button>
        </div>
        <div className="space-y-3">
          {columns.map((c, i) => (
            <div
              key={c.id}
              className="border border-border rounded-md p-3 bg-card flex gap-3"
            >
              <div className="flex-1 space-y-2 min-w-0">
                <Input
                  value={c.label}
                  onChange={(e) => updateColumn(i, { label: e.target.value })}
                  placeholder={t("form.columnLabelPlaceholder")}
                  aria-label={t("form.columnLabelAria")}
                  maxLength={80}
                />
                <Input
                  value={c.prompt}
                  onChange={(e) => updateColumn(i, { prompt: e.target.value })}
                  placeholder={t("form.columnPromptPlaceholder")}
                  aria-label={t("form.columnPromptAria")}
                  maxLength={500}
                />
              </div>
              <button
                type="button"
                onClick={() => removeColumn(i)}
                className="size-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                aria-label={t("form.removeColumnAria")}
              >
                <IconTrash className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Documents */}
      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-lg tracking-tight">{t("form.documentsHeading")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("form.documentsHint")}
          </p>
        </div>
        {documents.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
            {t("form.noDocuments")}
          </div>
        ) : (
          <div className="border border-border rounded-md bg-card max-h-72 overflow-y-auto divide-y divide-border">
            {documents.map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 cursor-pointer"
              >
                <Checkbox
                  checked={selectedDocs.includes(d.id)}
                  onCheckedChange={() => toggleDoc(d.id)}
                />
                <span className="text-sm truncate flex-1">{d.filename}</span>
              </label>
            ))}
          </div>
        )}
        {selectedDocs.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("form.selectedDocs", { count: selectedDocs.length })}
          </p>
        )}
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => router.push("/tabular-reviews")}
        >
          {t("form.cancel")}
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? t("form.submitting") : t("form.submit")}
        </Button>
      </div>
    </div>
  );
}
