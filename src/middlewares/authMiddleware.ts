// src/middlewares/authMiddleware.ts
import { supabase } from "../config/supabase";
import { Request, Response, NextFunction } from "express";

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let token = req.headers.authorization?.replace("Bearer ", "");

  // si viene en query, úsalo
  if (!token && req.query.token) {
    token = String(req.query.token); // aquí string porque ParsedQs puede ser string | array
  }

  if (!token) return res.status(401).json({ error: "Authorization token missing" });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) return res.status(401).json({ error: "Invalid or expired token" });

  (req as any).user = { id: data.user.id, email: data.user.email };

  next();
}
