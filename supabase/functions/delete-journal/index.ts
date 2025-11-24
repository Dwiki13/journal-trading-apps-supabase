import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // atau masukkan domain frontend kamu
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      // Preflight CORS
      return new Response(null, { headers: CORS_HEADERS });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(
        JSON.stringify({ error: "Missing Authorization" }),
        { status: 401, headers: CORS_HEADERS }
      );
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = await req.json().catch(() => ({}));
    const id = body?.id;
    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing journal ID" }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Ambil journal milik user
    const { data: journal, error: fetchError } = await supabase
      .from("journal")
      .select("id, user_id, analisa_before, analisa_after")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !journal) {
      return new Response(
        JSON.stringify({ error: "Journal not found or not owner" }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const extractStoragePath = (url: string | null): string | null => {
      if (!url) return null;
      try {
        const u = new URL(url);
        const marker = "/storage/v1/object/public/analisa/";
        const idx = u.pathname.indexOf(marker);
        if (idx !== -1) {
          let p = u.pathname.slice(idx + marker.length);
          if (p.startsWith("/")) p = p.slice(1);
          return decodeURIComponent(p);
        }
        const parts = url.split("/analisa/");
        if (parts.length > 1) return decodeURIComponent(parts[1].startsWith("/") ? parts[1].slice(1) : parts[1]);
        return null;
      } catch {
        return null;
      }
    };

    const beforePath = extractStoragePath(journal.analisa_before ?? null);
    const afterPath = extractStoragePath(journal.analisa_after ?? null);

    // Hapus DB
    const { error: deleteError } = await supabase
      .from("journal")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (deleteError) throw deleteError;

    // Hapus file storage
    const filesToDelete: string[] = [];
    if (beforePath) filesToDelete.push(beforePath);
    if (afterPath) filesToDelete.push(afterPath);

    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("analisa")
        .remove(filesToDelete);

      if (storageError) console.error("Storage remove error:", storageError);
    }

    return new Response(
      JSON.stringify({
        status: true,
        status_code: 200,
        message: "Journal and files deleted successfully",
      }),
      { headers: CORS_HEADERS, status: 200 }
    );
  } catch (err: any) {
    console.error("delete-journal error:", err);
    return new Response(
      JSON.stringify({
        status: false,
        status_code: 500,
        message: "Internal server error",
        error: err.message,
      }),
      { headers: CORS_HEADERS, status: 500 }
    );
  }
});
