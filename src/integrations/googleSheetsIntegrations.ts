import fetch from "node-fetch";
import axios from "axios";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/* ======================================================
   CREATE SPREADSHEET
====================================================== */
export async function createSpreadsheet(
  accessToken: string,
  title: string,
  headers: string[]
): Promise<{
  spreadsheetId: string;
  sheetName: string;
  sheetId: number;
}> {
  const res = await fetch(SHEETS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: { title: "Registros" },
          data: [
            {
              rowData: [
                {
                  values: headers.map((h) => ({
                    userEnteredValue: { stringValue: h },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: "CENTER",
                    },
                  })),
                },
              ],
            },
          ],
        },
      ],
    }),
  });

  const json = (await res.json()) as any;

  return {
    spreadsheetId: json.spreadsheetId,
    sheetName: "Registros",
    sheetId: json.sheets[0].properties.sheetId,
  };
}

/* ======================================================
   🎨 FORMAT SHEET (DISEÑO PROFESIONAL + PRIORIDADES)
====================================================== */
export async function formatSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number
) {
  const priorities = [
    { prioridad: "URGENTE", color: { red: 0.85, green: 0.2, blue: 0.2 }, bold: true, textColor: { red: 1, green: 1, blue: 1 } },
    { prioridad: "ALTA", color: { red: 1, green: 0.6, blue: 0.2 }, bold: false, textColor: { red: 0, green: 0, blue: 0 } },
    { prioridad: "MEDIA", color: { red: 1, green: 0.9, blue: 0.4 }, bold: false, textColor: { red: 0, green: 0, blue: 0 } },
    { prioridad: "BAJA", color: { red: 0.3, green: 0.75, blue: 0.4 }, bold: false, textColor: { red: 0, green: 0, blue: 0 } },
  ];

  await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },

        ...[160, 220, 120, 140, 130, 160, 420].map((width, index) => ({
          updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 }, properties: { pixelSize: width }, fields: "pixelSize" }
        })),

        { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, horizontalAlignment: "CENTER" } }, fields: "userEnteredFormat(textFormat,horizontalAlignment)" } },

        { repeatCell: { range: { sheetId, startRowIndex: 1 }, cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(wrapStrategy,verticalAlignment)" } },

        ...priorities.map((p, idx) => ({
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 10000, startColumnIndex: 0, endColumnIndex: 7 }],
              booleanRule: {
                // 🔥 ESTA ES LA CLAVE:
                condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=UPPER(TRIM($C2))="${p.prioridad}"` }] },
                format: { backgroundColor: p.color, textFormat: { bold: p.bold, foregroundColor: p.textColor } }
              }
            },
            index: idx
          }
        }))
      ]
    })
  });
}




/* ======================================================
   APPEND ROW
====================================================== */
export async function appendRow(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  return (await res.json()) as any;
}

/* ======================================================
   READ VALUES
====================================================== */
export async function getSheetValues(accessToken: string, spreadsheetId: string, range: string) {
  const res = await axios.get(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}
