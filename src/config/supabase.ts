import { createClient } from "@supabase/supabase-js";
import { Agent } from "undici";

const agent = new Agent({
  keepAliveTimeout: 60000,
  keepAliveMaxTimeout: 60000,
});
console.log("Supabase client creado");
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
  {
    global: {
      fetch: (url, options) => {
        return (globalThis as any).fetch(url, {
          ...options,
          // 🔥 usamos agent pero sin declarar dispatcher en types
          agent,
        });
      },
    },
  }
);