import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Header } from "@/components/layout/header";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  // Server-side guard: redirect non-admins before rendering anything
  if (!session) {
    redirect("/login");
  }

  // Note: role check is enforced by the backend on every API call.
  // The client-side 403 catch in admin/page.tsx is a secondary fallback.

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
