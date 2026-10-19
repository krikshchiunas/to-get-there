/**
 * Проверка живости для мониторинга (Vercel, UptimeRobot, Better Stack).
 *
 * Отвечает 200, когда приложение запущено и база отвечает, и 503, когда нет.
 * Наружу — только статус и время ответа базы: ни версий, ни адресов.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };

  if (usingMocks) {
    return NextResponse.json({ status: "ok", database: "mock" }, { headers });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ status: "error", database: "not configured" }, { status: 503, headers });
  }

  const started = Date.now();
  // Справочник вузов открыт анониму (0014) — значит, запрос проверяет связь,
  // а не права.
  const { error } = await createClient(url, key, { auth: { persistSession: false } })
    .from("universities")
    .select("id", { head: true, count: "exact" })
    .limit(1);
  const latencyMs = Date.now() - started;

  if (error) {
    return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503, headers });
  }
  return NextResponse.json({ status: "ok", database: "ok", latency_ms: latencyMs }, { headers });
}
