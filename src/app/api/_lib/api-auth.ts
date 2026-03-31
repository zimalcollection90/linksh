import { NextRequest } from "next/server";
import { createAdminClient } from "../../../../supabase/admin";
import { createClient } from "../../../../supabase/server";
import { NextResponse } from "next/server";

type ApiRole = "super_admin" | "admin" | "member";
type MemberStatus = "active" | "suspended" | "pending";

export type ApiContext = {
  authMode: "session" | "api_key";
  userId: string;
  role: ApiRole;
  memberStatus: MemberStatus;
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

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, status")
    .eq("id", authData.user.id)
    .single();

  if (!profile) {
    throw new Response("Account profile not found", { status: 403 });
  }

  const role = (
    profile.role === "admin" || profile.role === "super_admin"
      ? profile.role
      : "member"
  ) as ApiRole;
  const memberStatus = (profile.status || "pending") as MemberStatus;

  return {
    authMode: "session",
    userId: authData.user.id,
    role,
    memberStatus,
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
    .select("id, user_id, key_hash, is_active, usage_count, last_used_at")
    .eq("key_hash", token)
    .eq("is_active", true)
    .single();

  if (error || !keyRow) {
    throw new Response("Invalid API key", { status: 401 });
  }

  // Best-effort usage update
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

  const { data: profile } = await admin
    .from("users")
    .select("id, role, status")
    .eq("id", keyRow.user_id)
    .single();

  if (!profile) {
    throw new Response("Account profile not found", { status: 403 });
  }

  const role = (
    profile.role === "admin" || profile.role === "super_admin"
      ? profile.role
      : "member"
  ) as ApiRole;
  const memberStatus = (profile.status || "pending") as MemberStatus;

  return {
    authMode: "api_key",
    userId: keyRow.user_id,
    role,
    memberStatus,
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

export function requireActiveMember(ctx: ApiContext) {
  if (ctx.memberStatus !== "active") {
    throw new Response("Account not approved", { status: 403 });
  }
}

/** Returns a NextResponse error instead of throwing — use this in route handlers */
export function requireActiveUserResponse(ctx: ApiContext): NextResponse | null {
  if (ctx.memberStatus !== "active") {
    return NextResponse.json(
      { error: "Account not approved. Please wait for admin to activate your account." },
      { status: 403 }
    );
  }
  return null;
}

// Backward compatible alias
export const requireActiveMembership = requireActiveMember;
