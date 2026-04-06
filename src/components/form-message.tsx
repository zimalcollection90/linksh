import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type Message =
  | { success: string }
  | { error: string }
  | { message: string };

export function FormMessage({ message, className }: { message: Message; className?: string }) {
  if (!message || Object.keys(message).length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2 w-full text-sm", className)}>
      {"success" in message && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div className="flex-1 font-medium leading-relaxed">
            {message.success}
          </div>
        </div>
      )}
      {"error" in message && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-1 font-medium leading-relaxed">
            {message.error}
          </div>
        </div>
      )}
      {"message" in message && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-blue-600 dark:text-blue-400">
          <Info className="h-5 w-5 shrink-0" />
          <div className="flex-1 font-medium leading-relaxed">
            {message.message}
          </div>
        </div>
      )}
    </div>
  );
}
