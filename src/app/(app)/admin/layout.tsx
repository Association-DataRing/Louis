import { redirect } from "next/navigation";
import Link from "next/link";
import { IconShieldLock, IconUsers } from "@tabler/icons-react";
import { auth } from "@/auth";

const adminNavItems = [
  { href: "/admin/users", label: "Utilisateurs", icon: IconUsers },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex flex-col h-full">
      <header className="border-b border-border bg-card/40 px-8 py-4">
        <div className="flex items-center gap-2">
          <IconShieldLock className="size-4 text-primary" />
          <span className="font-heading text-sm tracking-tight">
            Administration
          </span>
        </div>
        <nav className="mt-3 flex items-center gap-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
