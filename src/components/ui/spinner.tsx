import { cn } from "@/lib/utils"
import { IconLoader } from "@tabler/icons-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex", className)}>
      <IconLoader aria-hidden className="size-4 motion-safe:animate-spin" {...props} />
      <span className="sr-only">Chargement</span>
    </span>
  )
}

export { Spinner }
