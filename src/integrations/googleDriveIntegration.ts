import fetch from "node-fetch";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

export async function createAutomationFolder(
  accessToken: string,
  name: string
): Promise<{ folderId: string }> {
  const res = await fetch(DRIVE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  const json = (await res.json()) as { id: string };
  return { folderId: json.id };
}

export async function uploadFile(
  accessToken: string,
  filename: string,
  mimeType: string,
  base64Data: string,
  folderId: string
) {
  const boundary = "upload_boundary";

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: filename, parents: [folderId] }) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    base64Data +
    `\r\n--${boundary}--`;

  const res = await fetch(`${UPLOAD_API}?uploadType=multipart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  return (await res.json()) as any;
}


interface DriveListResponse {
  files: {
    id: string;
    name: string;
    mimeType: string;
  }[];
}

export async function listFiles(accessToken: string) {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType)",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const json = (await res.json()) as DriveListResponse;
  return json.files;
}
