import { supabase } from "../config/supabase";

export async function listConnections(userId: string) {
  return supabase.from("connections").select("*").eq("user_id", userId);
}

export async function createConnection(userId: string, data: any) {
  const { data: inserted, error } = await supabase
    .from("connections")
    .insert([{ user_id: userId, ...data }])
    .select()
    .single();

  if (error) {
    console.error("Error insertando conexión:", error);
    throw error;
  }

  return inserted;
}


export async function deleteConnection(id: string, userId: string) {
  return supabase.from("connections")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
}

export async function deleteProviderConnections(userId: string, provider: string) {
  return supabase
    .from("connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
}

export async function getConnectionByProvider(userId: string, provider: string) {
  const { data } = await supabase
    .from("connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  return data;
}

export async function updateConnection(id: string, data: any) {
  return supabase
    .from("connections")
    .update(data)
    .eq("id", id)
    .select()
    .single();
}


export async function getConnection(userId: string, provider: string) {
  return supabase
    .from("connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();
}

export async function saveConnection(
  userId: string,
  provider: string,
  data: any
) {
  await supabase
    .from("connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  return supabase.from("connections").insert([
    { user_id: userId, provider, ...data }
  ]);
}