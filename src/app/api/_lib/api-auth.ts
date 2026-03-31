import { NextRequest } from "next/server";
import { createAdminClient } from "../../../../supabase/admin";
import { createClient } from "../../../../supabase/server";

type ApiRole = "super_admin" | "admin" | "member";
type MembershipStatus = "active" | "suspended" | "pending";
type MembershipRow = { company_id: string; role: ApiRole; status: MembershipStatus; created_at?: string };

export type ApiContext = {
  authMode: "session" | "api_key";
  userId: string;
  companyId: string;
  role: ApiRole;
  membershipStatus: MembershipStatus;
};

function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function rolePriority(role: ApiRole) {
  if (role === "super_admin") return 3;
  if (role === "admin") return 2;
  return 1;
}

function pickBestMembership(rows: MembershipRow[]) {
  const active = rows.filter((r) => r.status === "active");
  const pool = active.length > 0 ? active : rows;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => rolePriority(b.role) - rolePriority(a.role))[0];
}

async function getSessionContext(): Promise<ApiContext> {
  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.getUser();
  if (error || !authData.user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const { data: profileByUserId } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", authData.user.id)
    .single();
  const { data: profileById } = await supabase
    .from("users")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  const profile = profileByUserId || profileById;

  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id, role, status, created_at")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false });

  const membership = pickBestMembership((memberships || []) as MembershipRow[]);

  if (!membership?.company_id && profile?.role !== "admin") {
    throw new Response("No active company membership", { status: 403 });
  }

  return {
    authMode: "session",
    userId: authData.user.id,
    companyId: membership?.company_id || authData.user.id,
    role: ((profile?.role === "admin" ? "admin" : membership?.role || "member") as ApiRole),
    membershipStatus: ((membership?.status || (profile?.role === "admin" ? "active" : "pending")) as MembershipStatus),
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

  const { data: memberships } = await admin
    .from("company_members")
    .select("company_id, role, status, created_at")
    .eq("user_id", keyRow.user_id)
    .order("created_at", { ascending: false });

  const membership = pickBestMembership((memberships || []) as MembershipRow[]);
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", keyRow.user_id)
    .single();

  const role = ((profile?.role === "admin" ? "admin" : (membership?.role || "member")) as ApiRole);
  const membershipStatus = (membership?.status || "pending") as MembershipStatus;

  return {
    authMode: "api_key",
    userId: keyRow.user_id,
    companyId: membership?.company_id || keyRow.company_id,
    role,
    membershipStatus,
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

export function requireActiveMembership(ctx: ApiContext) {
  if (ctx.membershipStatus !== "active") {
    throw new Response("Membership is pending admin approval", { status: 403 });
  }
}

