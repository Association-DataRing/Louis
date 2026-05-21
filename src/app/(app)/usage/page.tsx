import { redirect } from "next/navigation";

export default function UsageRedirect() {
  redirect("/settings/usage");
}
