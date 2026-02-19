import { Request, Response } from "express";
import * as sheets from "../integrations/googleSheetsIntegrations";
import { getValidGoogleAccessToken } from "../helpers/googleAuthHelper";

export class SheetsController {

  /**
   * 📌 Leer hoja
   */
  static async getSheet(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { spreadsheetId, range } = req.query as {
        spreadsheetId?: string;
        range?: string;
      };

      if (!spreadsheetId || !range) {
        return res.status(400).json({
          error: "spreadsheetId y range son obligatorios",
        });
      }

      const accessToken = await getValidGoogleAccessToken(userId);
      if (!accessToken) {
        return res.status(400).json({ error: "Google no conectado" });
      }

      const data = await sheets.getSheetValues(
        accessToken,
        spreadsheetId,
        range
      );

      return res.json(data);
    } catch (err) {
      console.error("❌ Error leyendo sheet:", err);
      return res.status(500).json({ error: "Error leyendo sheet" });
    }
  }

  /**
   * 📌 Añadir fila
   */
  static async appendRow(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { spreadsheetId, sheetName, values } = req.body;
      if (!spreadsheetId || !sheetName || !values)
        return res.status(400).json({ error: "spreadsheetId, sheetName y values son obligatorios" });

      const accessToken = await getValidGoogleAccessToken(userId);
      if (!accessToken) return res.status(400).json({ error: "Google no conectado" });

      // ✅ Siempre añade debajo de la cabecera, rango fijo A2:G para que se aplique color condicional
      const resData = await sheets.appendRow(
        accessToken,
        spreadsheetId,
        sheetName,
        values
      );

      return res.json(resData);
    } catch (err) {
      console.error("❌ Error escribiendo sheet:", err);
      return res.status(500).json({ error: "Error escribiendo sheet" });
    }
  }
}
