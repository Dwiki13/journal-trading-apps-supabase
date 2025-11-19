// supabase/functions/add-journal/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // === CORS PRE-FLIGHT HANDLING ===
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // === Parse form-data ===
    const formData = await req.formData();

    const modal = formData.get("modal");
    const modal_type = formData.get("modal_type");
    const tanggal = formData.get("tanggal");
    const pair = formData.get("pair");
    const side = formData.get("side");
    const lot = formData.get("lot");
    const harga_entry = formData.get("harga_entry");
    const harga_take_profit = formData.get("harga_take_profit");
    const harga_stop_loss = formData.get("harga_stop_loss");
    const reason = formData.get("reason");
    const win_lose = formData.get("win_lose") ? formData.get("win_lose") : null;
    const profit = formData.get("profit") ? formData.get("profit") : null;

    const analisaBeforeFile = formData.get("analisaBefore") as File | null;
    const analisaAfterFile = formData.get("analisaAfter") as File | null;

    let analisaBeforeUrl: string | null = null;
    let analisaAfterUrl: string | null = null;

    // === Upload Before File ===
    if (analisaBeforeFile) {
      const filePath = `before/${user.id}-${Date.now()}-${
        analisaBeforeFile.name
      }`;
      const { error: uploadError } = await supabase.storage
        .from("analisa")
        .upload(filePath, analisaBeforeFile, {
          contentType: analisaBeforeFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("analisa")
        .getPublicUrl(filePath);
      analisaBeforeUrl = publicUrl.publicUrl;
    }

    // === Upload After File ===
    if (analisaAfterFile) {
      const filePath = `after/${user.id}-${Date.now()}-${
        analisaAfterFile.name
      }`;
      const { error: uploadError } = await supabase.storage
        .from("analisa")
        .upload(filePath, analisaAfterFile, {
          contentType: analisaAfterFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("analisa")
        .getPublicUrl(filePath);
      analisaAfterUrl = publicUrl.publicUrl;
    }

    // === Insert Journal ===
    const { error } = await supabase.from("journal").insert([
      {
        user_id: user.id,
        modal,
        modal_type,
        tanggal,
        pair,
        side,
        lot,
        harga_entry,
        harga_take_profit,
        harga_stop_loss,
        analisa_before: analisaBeforeUrl,
        analisa_after: analisaAfterUrl,
        reason,
        win_lose,
        profit,
      },
    ]);

    if (error) throw error;

    return new Response(
      JSON.stringify({
        status: true,
        status_code: 200,
        message: "Journal added successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("Error add-journal:", err);
    return new Response(
      JSON.stringify({
        status: false,
        status_code: 500,
        message: "Internal server error",
        error: err.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
