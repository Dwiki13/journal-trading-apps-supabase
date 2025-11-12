import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const addCors = (res: Response) => {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
  return new Response(res.body, { ...res, headers, status: res.status });
};

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
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
    const path = url.pathname;

    // 🔒 Verifikasi user
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

    // ============================================================
    // 1️⃣ GET JOURNAL (sudah filter user_id)
    // ============================================================
    if (path.endsWith("/journal")) {
      const page = Number(url.searchParams.get("page") || "1");
      const limit = Number(url.searchParams.get("limit") || "10");
      const pair = url.searchParams.get("pair");
      const tanggal = url.searchParams.get("tanggal");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      const winLose = url.searchParams.get("win_lose");
      const sortBy = url.searchParams.get("sort_by") || "tanggal";
      const sortOrder = url.searchParams.get("sort_order") === "asc";

      let query = supabase
        .from("journal")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

      if (pair) query = query.ilike("pair", `%${pair}%`);
      if (tanggal) query = query.eq("tanggal", tanggal);
      if (winLose) query = query.eq("win_lose", winLose);
      if (dateFrom && dateTo)
        query = query.gte("tanggal", dateFrom).lte("tanggal", dateTo);
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
    }

    // ============================================================
    // 2️⃣ GET DASHBOARD (logic equity & stats)
    // ============================================================
    if (path.endsWith("/dashboard")) {
      const { data: journals, error } = await supabase
        .from("journal")
        .select(
          "modal, side, tanggal, harga_entry, harga_take_profit, harga_stop_loss, lot, win_lose, profit"
        )
        .eq("user_id", user.id);

      if (error) throw error;

      if (!journals || journals.length === 0) {
        return addCors(
          new Response(
            JSON.stringify({
              status: true,
              status_code: 200,
              message: "No data available for dashboard",
              data: {
                equity: 0,
                total_pnl: 0,
                avg_rr: 0,
                win_rate: 0,
                daily: [],
                weekly: [],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      // === Total Profit (PnL) ===
      const totalProfit = journals.reduce(
        (sum, j) => sum + (Number(j.profit) || 0),
        0
      );

      // === Urutkan berdasarkan tanggal ===
      const sortedJournals = [...journals].sort(
        (a, b) => new Date(a.tanggal) - new Date(b.tanggal)
      );

      // === Temukan modal terakhir yang valid ===
      let lastModal = 0;
      for (let i = sortedJournals.length - 1; i >= 0; i--) {
        const m = Number(sortedJournals[i].modal);
        if (!isNaN(m) && m > 0) {
          lastModal = m;
          break;
        }
      }

      // === Hitung equity dengan logika dinamis ===
      let equity = lastModal;
      sortedJournals.forEach((j) => {
        const modalNow = Number(j.modal);
        const profitNow = Number(j.profit);

        // Jika user input modal baru → reset modal
        if (!isNaN(modalNow) && modalNow > 0) {
          equity = modalNow;
        }

        // Tambah / kurang sesuai profit
        if (!isNaN(profitNow)) {
          equity += profitNow;
        }
      });

      // === Average Risk Reward (RR) ===
      const rrList = journals
        .filter(
          (j) =>
            j.harga_entry &&
            j.harga_take_profit &&
            j.harga_stop_loss &&
            j.side &&
            j.harga_entry !== j.harga_stop_loss
        )
        .map((j) => {
          const entry = Number(j.harga_entry);
          const tp = Number(j.harga_take_profit);
          const sl = Number(j.harga_stop_loss);
          const side = j.side.toUpperCase();

          let reward = 0;
          let risk = 0;

          if (side === "BUY") {
            reward = tp - entry;
            risk = entry - sl;
          } else if (side === "SELL") {
            reward = entry - tp;
            risk = sl - entry;
          }

          reward = Math.abs(reward);
          risk = Math.abs(risk);

          return risk > 0 ? reward / risk : 0;
        })
        .filter((rr) => rr > 0);

      const avgRR =
        rrList.length > 0
          ? rrList.reduce((a, b) => a + b, 0) / rrList.length
          : 0;

      // === Win Rate ===
      const totalTrades = journals.length;
      const winTrades = journals.filter(
        (j) => j.win_lose?.toLowerCase() === "win"
      ).length;
      const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;

      // === Daily Performance ===
      const dailyMap = new Map();
      journals.forEach((j) => {
        const d = j.tanggal;
        dailyMap.set(d, (dailyMap.get(d) || 0) + (Number(j.profit) || 0));
      });
      const daily = Array.from(dailyMap, ([date, pnl]) => ({ date, pnl }));

      // === Weekly Performance (ISO Week) ===
      function getISOWeek(date) {
        const tempDate = new Date(date);
        tempDate.setHours(0, 0, 0, 0);
        tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
        const week1 = new Date(tempDate.getFullYear(), 0, 4);
        return (
          tempDate.getFullYear() +
          "-W" +
          String(
            1 +
              Math.round(
                ((tempDate - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) /
                  7
              )
          ).padStart(2, "0")
        );
      }

      const weeklyMap = new Map();
      journals.forEach((j) => {
        const week = getISOWeek(new Date(j.tanggal));
        weeklyMap.set(week, (weeklyMap.get(week) || 0) + (Number(j.profit) || 0));
      });
      const weekly = Array.from(weeklyMap, ([week, pnl]) => ({ week, pnl }));

      // === Response ===
      return addCors(
        new Response(
          JSON.stringify({
            status: true,
            status_code: 200,
            message: "Dashboard data calculated successfully",
            data: {
              equity,
              total_pnl: totalProfit,
              avg_rr: Number(avgRR.toFixed(2)),
              win_rate: Number(winRate.toFixed(2)),
              daily,
              weekly,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    }

    // Default jika endpoint tidak ditemukan
    return addCors(
      new Response(
        JSON.stringify({
          status: false,
          status_code: 404,
          message: "Endpoint not found",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    );
  } catch (err) {
    console.error("❌ Error get-journal/dashboard:", err);
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
