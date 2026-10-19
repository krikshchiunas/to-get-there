/** Последняя заявка на проверку личности — для экрана верификации. */

import { createClient } from "@/lib/supabase/server";
import type { VerificationStatus } from "@/lib/stripe-identity";
import { requireViewerId } from "./session";

export interface VerificationState {
  status: VerificationStatus;
  errorCode: string | null;
  updatedAt: string;
}

export async function getLatestVerification(): Promise<VerificationState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("verification_requests")
    .select("status, last_error_code, updated_at")
    .eq("user_id", await requireViewerId())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    status: data.status as VerificationStatus,
    errorCode: data.last_error_code,
    updatedAt: data.updated_at,
  };
}
