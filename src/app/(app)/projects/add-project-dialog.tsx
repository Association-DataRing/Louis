"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconPlus, IconFolder } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createProject } from "./actions";

export type FolderNode = {
  id: string;
  name: string;
  parentFolderId: string | null;
};

export function AddProjectDialog({ folders }: { folders: FolderNode[] }) {
  const router = useRouter();
  const t = useTranslations("projects.addDialog");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasFolders = folders.length > 0;
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    if (mode === "existing" && !selectedFolderId) {
      setError(t("chooseFolderError"));
      return;
    }
    startTransition(async () => {
      const result = await createProject(null, formData);
      if (result.ok) {
        setOpen(false);
        setMode("new");
        setSelectedFolderId(null);
        if (result.id) router.push(`/projects/${result.id}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="size-4" />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("nameLabel")}</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={80}
              autoFocus
              placeholder={t("namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">
              {t("descriptionLabel")}{" "}
              <span className="text-[10px] text-muted-foreground font-normal">
                {t("optional")}
              </span>
            </Label>
            <Input
              id="description"
              name="description"
              maxLength={500}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("storageLabel")}</Label>
            <p className="text-xs text-muted-foreground">{t("storageHint")}</p>

            <input type="hidden" name="folderMode" value={mode} />

            {hasFolders && (
              <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className={`rounded-sm px-3 py-1 transition-colors ${
                    mode === "new"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("newFolder")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("existing")}
                  className={`rounded-sm px-3 py-1 transition-colors ${
                    mode === "existing"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("existingFolder")}
                </button>
              </div>
            )}

            {mode === "new" ? (
              <Input
                name="folderName"
                maxLength={80}
                placeholder={t("folderNamePlaceholder")}
              />
            ) : (
              <>
                <input
                  type="hidden"
                  name="folderId"
                  value={selectedFolderId ?? ""}
                />
                <FolderTree
                  folders={folders}
                  selectedId={selectedFolderId}
                  onSelect={setSelectedFolderId}
                />
              </>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FolderTree({
  folders,
  selectedId,
  onSelect,
}: {
  folders: FolderNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, FolderNode[]>();
    for (const f of folders) {
      const list = map.get(f.parentFolderId) ?? [];
      list.push(f);
      map.set(f.parentFolderId, list);
    }
    for (const list of map.values())
      list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);

  function renderLevel(
    parentId: string | null,
    depth: number
  ): React.ReactNode {
    const nodes = childrenByParent.get(parentId) ?? [];
    return nodes.map((f) => (
      <Fragment key={f.id}>
        <button
          type="button"
          role="treeitem"
          aria-selected={selectedId === f.id}
          aria-level={depth + 1}
          onClick={() => onSelect(f.id)}
          className={`flex w-full items-center gap-2 px-2 py-1.5 text-sm text-left transition-colors ${
            selectedId === f.id
              ? "bg-accent text-foreground"
              : "hover:bg-accent/40"
          }`}
          style={{ paddingLeft: depth * 16 + 8 }}
        >
          <IconFolder className="size-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{f.name}</span>
        </button>
        {renderLevel(f.id, depth + 1)}
      </Fragment>
    ));
  }

  return (
    <div
      role="tree"
      className="max-h-48 overflow-y-auto rounded-md border border-border bg-card divide-y divide-border/60"
    >
      {renderLevel(null, 0)}
    </div>
  );
}
