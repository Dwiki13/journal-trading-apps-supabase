// supabase/functions/delete-journal/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""; // PASTIKAN service role key
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
      });
    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const body = await req.json().catch(() => ({}));
    const id = body?.id;
    if (!id)
      return new Response(JSON.stringify({ error: "Missing journal ID" }), {
        status: 400,
      });

    // Ambil journal milik user (verifikasi owner)
    const { data: journal, error: fetchError } = await supabase
      .from("journal")
      .select("id, user_id, analisa_before, analisa_after")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !journal) {
      return new Response(
        JSON.stringify({ error: "Journal not found or not owner" }),
        { status: 404 }
      );
    }

    // Helper: ekstrak path storage relatif dari public URL
    const extractStoragePath = (url: string | null): string | null => {
      if (!url) return null;
      try {
        // contoh path yang kita cari: /storage/v1/object/public/analisa/before/xxx.png
        const u = new URL(url);
        const marker = "/storage/v1/object/public/analisa/";
        const idx = u.pathname.indexOf(marker);
        if (idx !== -1) {
          let p = u.pathname.slice(idx + marker.length);
          p = decodeURIComponent(p);
          // pastikan tidak ada leading slash
          if (p.startsWith("/")) p = p.slice(1);
          return p;
        }

        // fallback: cari '/analisa/' di seluruh URL (untuk format lain)
        const parts = url.split("/analisa/");
        if (parts.length > 1) {
          let p = parts[1];
          p = decodeURIComponent(p);
          return p.startsWith("/") ? p.slice(1) : p;
        }

        return null;
      } catch (e) {
        // fallback sederhana
        const parts = String(url).split("/analisa/");
        if (parts.length > 1) {
          return decodeURIComponent(parts[1]);
        }
        return null;
      }
    };

    const beforePath = extractStoragePath(journal.analisa_before ?? null);
    const afterPath = extractStoragePath(journal.analisa_after ?? null);

    // Hapus row DB dulu
    const { error: deleteError } = await supabase
      .from("journal")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) throw deleteError;

    // Siapkan list file untuk dihapus (relatif di bucket)
    const filesToDelete: string[] = [];
    if (beforePath) filesToDelete.push(beforePath);
    if (afterPath) filesToDelete.push(afterPath);

    // Hapus file di storage (jika ada)
    let storageResult: any = null;
    if (filesToDelete.length > 0) {
      const { data: removeData, error: storageError } = await supabase.storage
        .from("analisa")
        .remove(filesToDelete);

      storageResult = { removeData, storageError };
      if (storageError) {
        console.error("Storage remove error:", storageError);
        // jangan throw supaya DB yang sudah dihapus tetap konsisten,
        // tapi kembalikan info error storage supaya bisa debugging
        return new Response(
          JSON.stringify({
            message: "Journal deleted but some storage deletions failed",
            filesAttempted: filesToDelete,
            storageError,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        status: true,
        status_code: 200,
        message: "Journal and files deleted successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("delete-journal error:", err);
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
