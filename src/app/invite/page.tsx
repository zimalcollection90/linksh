import { createClient } from "../../../supabase/server";
import { redirect, notFound } from "next/navigation";
import { FormMessage, Message } from "@/components/form-message";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function InviteAcceptPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  const token = sp.token;

  if (!token) return notFound();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    const redirectTo = `/invite?token=${encodeURIComponent(token)}`;
    return redirect(`/sign-in?redirect_to=${encodeURIComponent(redirectTo)}`);
  }

  try {
    const { error } = await supabase.rpc("accept_invite", { p_token: token });
    if (error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
            <FormMessage message={{ error: error.message } satisfies Message} />
            <div className="mt-4 flex gap-3">
              <Button className="flex-1" onClick={() => redirect("/dashboard")}>
                Go to dashboard
              </Button>
              <Link href="/dashboard" className="hidden">Dashboard</Link>
            </div>
          </div>
        </div>
      );
    }
  } catch (e: any) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
          <FormMessage message={{ error: e?.message || "Invalid invite" } satisfies Message} />
          <div className="mt-4">
            <Link href="/dashboard" className="text-primary hover:underline">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  redirect("/dashboard");
}

