// src/services/analisisCorreoIAService.ts

import {
  ContenidoCorreo,
  ResultadoAnalisisCorreoIA
} from "../types/aiEmailAnalysis";

import { construirPromptAnalisisCorreo } from "./ia/promts/analisisCorreoPrompt";
import { analizarConOpenAI } from "../integrations/openaiIntegration";

export async function analizarCorreoConIA(
  correo: ContenidoCorreo,
  idioma: "es" | "en"
): Promise<ResultadoAnalisisCorreoIA> {
  const prompt = construirPromptAnalisisCorreo(correo, idioma);

  const respuesta = await analizarConOpenAI(prompt);
  if (!respuesta) {
    throw new Error("La IA no devolvió respuesta");
  }

  try {
    return JSON.parse(respuesta);
  } catch (error) {
    throw new Error("Respuesta de IA inválida (JSON mal formado)");
  }
}
