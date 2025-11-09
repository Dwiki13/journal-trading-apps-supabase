// supabase/functions/add-journal/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      modal,
      modal_type,
      tanggal,
      pair,
      side,
      lot,
      harga_entry,
      harga_take_profit,
      harga_stop_loss,
      reason,
      win_lose,
      profit,
    } = await req.json();

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");

    // Verifikasi user dari token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    // Insert ke tabel journal
    const { error } = await supabase
      .from("journal")
      .insert([
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
          reason,
          win_lose,
          profit,
        },
      ]);

    if (error) throw error;

    return new Response(JSON.stringify({ message: "Journal added successfully" }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
