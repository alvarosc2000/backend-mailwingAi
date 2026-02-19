import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const userId = "689c0b65-eec1-437f-a6d3-79e2558d3f43";

async function deleteTestUser() {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("Error borrando usuario:", error.message);
  } else {
    console.log("Usuario borrado correctamente. Ahora puedes probar el billing.");
  }
}

deleteTestUser();
