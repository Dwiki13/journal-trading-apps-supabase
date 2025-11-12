import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helper untuk menambahkan CORS headers
const addCors = (res: Response) => {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*"); // ganti * dengan domain frontend kamu untuk lebih aman
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
  return new Response(res.body, { ...res, headers, status: res.status });
};

serve(async (req) => {
  try {
    // Handle OPTIONS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*", // ganti * sesuai domain frontend
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Authorization,Content-Type",
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return addCors(
        new Response(
          JSON.stringify({
            status: false,
            status_code: 401,
            message: "Missing Authorization header",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const url = new URL(req.url);

    const page = Number(url.searchParams.get("page") || "1");
    const limit = Number(url.searchParams.get("limit") || "10");
    const pair = url.searchParams.get("pair");
    const tanggal = url.searchParams.get("tanggal");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");
    const winLose = url.searchParams.get("win_lose");
    const sortBy = url.searchParams.get("sort_by") || "tanggal";
    const sortOrder = url.searchParams.get("sort_order") === "asc";

    // Verifikasi user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return addCors(
        new Response(
          JSON.stringify({
            status: false,
            status_code: 401,
            message: "Unauthorized user",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )
      );
    }

    // Query jurnal
    let query = supabase
      .from("journal")
      .select("*", { count: "exact" })
      .eq("user_id", user.id);

    if (pair) query = query.ilike("pair", `%${pair}%`);
    if (tanggal) query = query.eq("tanggal", tanggal);
    if (winLose) query = query.eq("win_lose", winLose);

    if (dateFrom && dateTo) query = query.gte("tanggal", dateFrom).lte("tanggal", dateTo);
    else if (dateFrom) query = query.gte("tanggal", dateFrom);
    else if (dateTo) query = query.lte("tanggal", dateTo);

    query = query.order(sortBy, { ascending: sortOrder });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return addCors(
      new Response(
        JSON.stringify({
          status: true,
          status_code: 200,
          message: "Journals fetched successfully",
          data,
          page,
          limit,
          total: count,
          total_pages: Math.ceil((count || 0) / limit),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
  } catch (err) {
    console.error("❌ Error get-journal:", err);
    return addCors(
      new Response(
        JSON.stringify({
          status: false,
          status_code: 500,
          message: "Internal server error",
          error: err.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    );
  }
});
