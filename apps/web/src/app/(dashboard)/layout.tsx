import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { EmailVerificationBanner } from "@/components/layout/email-verification-banner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-screen bg-background text-foreground selection:bg-primary/20">
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
            <EmailVerificationBanner />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
