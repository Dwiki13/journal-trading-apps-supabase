import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function extractStoragePath(publicUrl) {
  if (!publicUrl) return null;
  try {
    const url = new URL(publicUrl);
    const parts = url.pathname.split("/storage/v1/object/public/analisa/");
    const rawPath = parts[1] || null;
    if (!rawPath) return null;
    return decodeURIComponent(rawPath); // 🔥 decode semua karakter yang di-encode
  } catch {
    return null;
  }
}

serve(async (req) => {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ error: "Expected multipart/form-data" }),
        {
          status: 400,
        }
      );
    }

    const formData = await req.formData();
    const id = formData.get("id");
    const userId = formData.get("userId");

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing journal ID" }), {
        status: 400,
      });
    }

    const { data: oldData, error: getErr } = await supabase
      .from("journal")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (getErr || !oldData) {
      return new Response(JSON.stringify({ error: "Journal not found" }), {
        status: 404,
      });
    }

    const bucket = supabase.storage.from("analisa");
    let analisaBeforePath = oldData.analisa_before;
    let analisaAfterPath = oldData.analisa_after;

    const analisaBefore = formData.get("analisaBefore") as File | null;
    const analisaAfter = formData.get("analisaAfter") as File | null;

    // --- Upload Before ---
    if (analisaBefore instanceof File && analisaBefore.size > 0) {
      // Hapus file lama jika ada
      const oldBeforePath = extractStoragePath(oldData.analisa_before);
      if (oldBeforePath) {
        console.log("🗑️ Deleting old before file:", oldBeforePath);
        await bucket.remove([oldBeforePath]);
      }

      const beforePath = `before/${userId}-${Date.now()}-${analisaBefore.name}`;
      const { error: uploadErrBefore } = await bucket.upload(
        beforePath,
        analisaBefore,
        {
          upsert: true,
        }
      );
      if (uploadErrBefore) throw uploadErrBefore;

      const { data } = bucket.getPublicUrl(beforePath);
      analisaBeforePath = data.publicUrl;
    }

    // --- Upload After ---
    if (analisaAfter instanceof File && analisaAfter.size > 0) {
      // Hapus file lama jika ada
      const oldAfterPath = extractStoragePath(oldData.analisa_after);
      if (oldAfterPath) {
        console.log("🗑️ Deleting old after file:", oldAfterPath);
        await bucket.remove([oldAfterPath]);
      }

      const afterPath = `after/${userId}-${Date.now()}-${analisaAfter.name}`;
      const { error: uploadErrAfter } = await bucket.upload(
        afterPath,
        analisaAfter,
        {
          upsert: true,
        }
      );
      if (uploadErrAfter) throw uploadErrAfter;

      const { data } = bucket.getPublicUrl(afterPath);
      analisaAfterPath = data.publicUrl;
    }

    // --- Build payload update ---
    const fields = [
      "modal",
      "modalType",
      "tanggal",
      "pair",
      "side",
      "lot",
      "hargaEntry",
      "hargaTakeProfit",
      "hargaStopLoss",
      "reason",
      "winLose",
      "profit",
    ];

    const updateData: Record<string, any> = {};
    for (const field of fields) {
      const value = formData.get(field);
      if (value !== null && value !== "") {
        switch (field) {
          case "modalType":
            updateData.modal_type = value;
            break;
          case "hargaEntry":
            updateData.harga_entry = value;
            break;
          case "hargaTakeProfit":
            updateData.harga_take_profit = value;
            break;
          case "hargaStopLoss":
            updateData.harga_stop_loss = value;
            break;
          case "winLose":
            updateData.win_lose = value;
            break;
          default:
            updateData[field] = value;
        }
      }
    }

    updateData.analisa_before = analisaBeforePath;
    updateData.analisa_after = analisaAfterPath;

    const { error: updateErr } = await supabase
      .from("journal")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({
        status: true,
        status_code: 200,
        message: "Journal updated successfully",
        updatedFields: updateData,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Update error:", error);
    return new Response(
      JSON.stringify({
        status: false,
        status_code: 500,
        message: "Internal server error",
        error: err.message,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
