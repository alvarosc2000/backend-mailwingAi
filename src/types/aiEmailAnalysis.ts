// src/types/analisisCorreoIA.ts

export interface ContenidoCorreo {
  asunto: string;
  remitente: string;
  destinatario?: string;
  fecha?: string;

  textoPlano: string;
  html?: string;

  adjuntos: {
    nombre: string;
    tipoMime: string;
    tamañoBytes?: number;
    textoExtraido?: string;
  }[];
}

export interface ResultadoAnalisisCorreoIA {
  resumenEjecutivo: string;

  prioridad: "baja" | "media" | "alta" | "urgente";
  categoria:
    | "ventas"
    | "soporte"
    | "facturacion"
    | "legal"
    | "rrhh"
    | "operativo"
    | "marketing"
    | "otro";

  sentimiento: "positivo" | "neutral" | "negativo";
  requiereAccion: boolean;

  puntosClave: string[];

  fechasLimite?: string[];

  entidadesDetectadas?: {
    personas?: string[];
    empresas?: string[];
    importes?: string[];
    fechas?: string[];
    referencias?: string[];
  };

  riesgosDetectados?: string[];
  accionesSugeridas?: string[];

  nivelConfianza: number; // 0 a 1
}
