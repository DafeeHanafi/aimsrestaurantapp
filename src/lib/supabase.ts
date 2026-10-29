import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REMOTE_URL = import.meta.env.VITE_SUPABASE_URL || "https://vajojrsdblrlhcntuphz.supabase.co";
const REMOTE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export async function connectBackend(): Promise<{ sb: SupabaseClient; label: string }> {
  try {
    const probe = await fetch(LOCAL_URL + "/rest/v1/", {
      headers: { apikey: LOCAL_ANON, Authorization: "Bearer " + LOCAL_ANON }
    });
    if (probe.ok) {
      return { sb: createClient(LOCAL_URL, LOCAL_ANON), label: "local supabase :54321" };
    }
  } catch {
    /* hosted */
  }
  return { sb: createClient(REMOTE_URL, REMOTE_ANON), label: "local app · hosted supabase" };
}
