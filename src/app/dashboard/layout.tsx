import { redirect } from "next/navigation";
import { createClient } from "../../../supabase/server";
import AppSidebar from "@/components/app-sidebar";
import TopHeader from "@/components/top-header";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
