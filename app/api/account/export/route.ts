/**
 * «Скачать мои данные» (DSGVO ст. 15 и 20): JSON-файл со всем, что человек
 * написал и настроил. Собирает база — public.export_my_data() (0034) через
 * RLS, поэтому в файл попадает ровно то, что человек и так видит.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export const dynamic = "force-dynamic";

export async function GET() {
  if (usingMocks) {
    return NextResponse.json({ error: "В демо без базы выгружать нечего." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Войди, чтобы скачать свои данные." }, { status: 401 });

  const { data, error } = await supabase.rpc("export_my_data");
  if (error || !data) {
    return NextResponse.json({ error: "Не получилось собрать данные. Попробуй ещё раз." }, { status: 500 });
  }

  const profile = (data as { profile?: { nickname?: string } }).profile;
  const day = new Date().toISOString().slice(0, 10);
  const name = `to-get-there-${profile?.nickname ?? "export"}-${day}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      // Личные данные: ни браузер, ни CDN не должны их сохранять.
      "Cache-Control": "no-store, private",
    },
  });
}
