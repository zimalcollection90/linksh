import { NextRequest } from "next/server";
import { createAdminClient } from "../../../../supabase/admin";
import { createClient } from "../../../../supabase/server";

type ApiRole = "super_admin" | "admin" | "member";

export type ApiContext = {
  authMode: "session" | "api_key";
  userId: string;
  companyId: string;
  role: ApiRole;
};

function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function getSessionContext(): Promise<ApiContext> {
  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.getUser();
  if (error || !authData.user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", authData.user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership?.company_id) {
    throw new Response("No active company membership", { status: 403 });
  }

  return {
    authMode: "session",
    userId: authData.user.id,
    companyId: membership.company_id,
    role: membership.role as ApiRole,
  };
}

async function getApiKeyContext(req: NextRequest): Promise<ApiContext> {
  const token = getBearerToken(req);
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: keyRow, error } = await admin
    .from("api_keys")
    .select("id, user_id, company_id, key_hash, is_active, usage_count, last_used_at")
    .eq("key_hash", token)
    .eq("is_active", true)
    .single();

  if (error || !keyRow) {
    throw new Response("Invalid API key", { status: 401 });
  }

  // Best-effort usage update (doesn't need to block the request)
  void (async () => {
    try {
      await admin
        .from("api_keys")
        .update({
          usage_count: (keyRow.usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", keyRow.id);
    } catch {
      // Best-effort only.
    }
  })();

  const { data: membership } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", keyRow.company_id)
    .eq("user_id", keyRow.user_id)
    .eq("status", "active")
    .limit(1)
    .single();

  const role = (membership?.role || "member") as ApiRole;

  return {
    authMode: "api_key",
    userId: keyRow.user_id,
    companyId: keyRow.company_id,
    role,
  };
}

export async function getApiContext(req: NextRequest): Promise<ApiContext> {
  const bearer = getBearerToken(req);
  if (bearer) return getApiKeyContext(req);
  return getSessionContext();
}

export function requireAdmin(ctx: ApiContext) {
  if (ctx.role !== "admin" && ctx.role !== "super_admin") {
    throw new Response("Forbidden", { status: 403 });
  }
}

