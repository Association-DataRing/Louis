import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const t = await getTranslations("admin.nav");

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-border px-6 h-[52px] flex items-center gap-3 shrink-0">
        <Link
          href="/dashboard"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {t("back")}
        </Link>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-sm font-medium">{t("administration")}</span>
      </header>

      <div className="flex-1 min-h-0 flex">
        <aside className="hidden md:flex shrink-0 w-64 border-r border-border overflow-y-auto p-4">
          <AdminNav />
        </aside>
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="md:hidden border-b border-border px-4 py-2 overflow-x-auto">
            <AdminNav horizontal />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
