import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

let cache: { timestamp: number; data: any } | null = null;
const CACHE_DURATION = 300 * 1000; // 5 menit
const REQUIRED_KEY = Deno.env.get("PROXY_SECRET") ?? "";

function validateProxy(req: Request) {
  const key = req.headers.get("x-proxy-secret");
  return key === REQUIRED_KEY;
}

async function getCryptoUSDT() {
  try {
    const res = await fetch("https://api.binance.com/api/v3/exchangeInfo");
    const json = await res.json();
    return json.symbols
      .filter((s: any) => s.symbol.endsWith("USDT"))
      .map((s: any) => s.symbol);
  } catch {
    return [];
  }
}

async function getRealXAUUSD() {
  try {
    const res = await fetch("https://api.twelvedata.com/price?symbol=XAU/USD");
    const json = await res.json();
    if (json.status === "error") return ["XAUUSD"];
    return ["XAUUSD"];
  } catch {
    return ["XAUUSD"];
  }
}

serve(async (req) => {
  // ======= HANDLE CORS PRE-FLIGHT =======
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-proxy-secret",
      },
    });
  }

  try {
    if (!validateProxy(req)) {
      return new Response(
        JSON.stringify({
          status: false,
          status_code: 401,
          message: "Unauthorized reverse-proxy",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-proxy-secret",
          },
        }
      );
    }

    const now = Date.now();
    if (cache && now - cache.timestamp < CACHE_DURATION) {
      return new Response(JSON.stringify(cache.data), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-proxy-secret",
        },
      });
    }

    const cryptoPairs = await getCryptoUSDT();
    const forexPairs = [
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "USDCHF",
      "AUDUSD",
      "NZDUSD",
      "USDCAD",
      "EURJPY",
      "GBPJPY",
      "CHFJPY",
    ];
    const realXAU = await getRealXAUUSD();
    const commodityPairs = [...realXAU, "XAGUSD", "WTIUSD", "BRENTUSD"];
    let allPairs = Array.from(
      new Set([...cryptoPairs, ...forexPairs, ...commodityPairs])
    ).sort();

    const url = new URL(req.url);
    let type = url.searchParams.get("type"); // optional
    const search = url.searchParams.get("search") ?? ""; // default string kosong

    // Filter berdasarkan type kalau dikirim
    if (type === "crypto") allPairs = cryptoPairs;
    if (type === "forex") allPairs = forexPairs;
    if (type === "commodity") allPairs = commodityPairs;

    // Filter search jika ada
    if (search) {
      allPairs = allPairs.filter((p) =>
        p.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Tentukan type otomatis jika tidak dikirim
    if (!type && allPairs.length > 0) {
      const first = allPairs[0];
      if (cryptoPairs.includes(first)) type = "crypto";
      else if (forexPairs.includes(first)) type = "forex";
      else if (commodityPairs.includes(first)) type = "commodity";
    }

    // Response
    const responseData = {
      status: true,
      status_code: 200,
      message: "Pairs fetched successfully",
      type: type ?? null, // tambahkan field type
      data: allPairs,
      total: allPairs.length,
    };

    cache = { timestamp: now, data: responseData };

    return new Response(JSON.stringify(responseData), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-proxy-secret",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: false,
        status_code: 500,
        message: "Failed to load pairs",
        error: err?.message || String(err),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-proxy-secret",
        },
      }
    );
  }
});
