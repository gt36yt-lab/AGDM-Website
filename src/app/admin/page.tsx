import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAdminSession } from "@/lib/auth";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
  const cookie = (await headers()).get("cookie");
  const authed = await isAdminSession(cookie);
  if (!authed) {
    redirect("/admin/login");
  }

  return <AdminDashboard />;
}
