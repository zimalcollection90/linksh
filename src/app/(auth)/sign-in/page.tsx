import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Zap } from "lucide-react";

interface LoginProps {
  searchParams: Promise<Message>;
}

export default async function SignInPage({ searchParams }: LoginProps) {
  const message = await searchParams;

  if ("message" in message) {
    return (
      <div className="flex h-screen w-full flex-1 items-center justify-center p-4 sm:max-w-md">
        <FormMessage message={message} />
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-xl" style={{ fontFamily: "Syne, sans-serif" }}>LinkFlux</span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
            <form className="flex flex-col space-y-5">
              <div className="space-y-1.5 text-center">
                <h1 className="text-2xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>Welcome back</h1>
                <p className="text-sm text-muted-foreground">
                  Don&apos;t have an account?{" "}
                  <Link className="text-primary font-medium hover:underline" href="/sign-up">
                    Sign up
                  </Link>
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="you@example.com" required className="bg-background" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <Link className="text-xs text-muted-foreground hover:text-foreground" href="/forgot-password">
                      Forgot Password?
                    </Link>
                  </div>
                  <Input id="password" type="password" name="password" placeholder="••••••••" required className="bg-background" />
                </div>
              </div>

              <SubmitButton className="w-full bg-primary hover:bg-primary/90 text-white" pendingText="Signing in..." formAction={signInAction}>
                Sign in
              </SubmitButton>

              <FormMessage message={message} />
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
