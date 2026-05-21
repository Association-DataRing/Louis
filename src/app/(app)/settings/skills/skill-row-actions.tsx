"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IconDotsVertical,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteSkill } from "./actions";
import { SkillFormDialog } from "./skill-form-dialog";

interface Props {
  skill: {
    id: string;
    name: string;
    description: string;
    triggerHint: string;
    systemPrompt: string;
  };
}

export function SkillRowActions({ skill }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSkill(skill.id);
      if (result.ok) {
        setDeleteOpen(false);
        router.refresh();
        toast.success("Compétence supprimée", { description: skill.name });
      } else {
        toast.error("Suppression impossible", { description: result.error });
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Actions pour ${skill.name}`}
          >
            <IconDotsVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <IconEdit className="size-4" />
            Éditer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <IconTrash className="size-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SkillFormDialog
        mode={{
          kind: "edit",
          skillId: skill.id,
          initial: {
            name: skill.name,
            description: skill.description,
            triggerHint: skill.triggerHint,
            systemPrompt: skill.systemPrompt,
          },
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
        trigger={<span style={{ display: "none" }} />}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette compétence ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {skill.name} » sera définitivement supprimée. L&apos;IA ne
              l&apos;activera plus automatiquement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
