/**
 * Google OAuth + Drive REST API v3 wrapper.
 * Uses Google Identity Services (GIS) for auth and raw fetch for Drive operations.
 * Scopes:
 *   - drive.file: create/update files created by this app
 *   - drive.metadata.readonly: browse existing folders
 */

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
].join(' ');
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/* ------------------------------------------------------------------ */
/*  GIS script loader                                                  */
/* ------------------------------------------------------------------ */

let gisLoaded = false;
let gisLoadPromise: Promise<void> | null = null;

export function loadGisScript(): Promise<void> {
  if (gisLoaded && window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('Failed to load Google Identity Services script'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

/* ------------------------------------------------------------------ */
/*  Token management                                                   */
/* ------------------------------------------------------------------ */

export interface GoogleToken {
  access_token: string;
  expires_at: number; // epoch ms
}

function getClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!id) throw new Error('VITE_GOOGLE_CLIENT_ID is not set');
  return id;
}

/** Check if Google Drive integration is configured (client ID is set). */
export function isGoogleDriveConfigured(): boolean {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  return !!id;
}

/**
 * Request an access token via GIS popup.
 * Resolves with the token or rejects if the user declines.
 */
export function requestAccessToken(): Promise<GoogleToken> {
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve({
          access_token: response.access_token,
          expires_at: Date.now() + response.expires_in * 1000,
        });
      },
      error_callback: (error) => {
        reject(new Error(error.message || 'OAuth error'));
      },
    });
    client.requestAccessToken();
  });
}

/** Check if a token is still valid (with 60s buffer). */
export function isTokenValid(token: GoogleToken | null): boolean {
  if (!token) return false;
  return token.expires_at > Date.now() + 60_000;
}

/** Revoke a token. */
export function revokeToken(token: string): Promise<void> {
  return new Promise<void>((resolve) => {
    window.google!.accounts.oauth2.revoke(token, () => resolve());
  });
}

/* ------------------------------------------------------------------ */
/*  Drive API helpers                                                  */
/* ------------------------------------------------------------------ */

async function driveRequest(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new DriveApiError(res.status, body);
  }
  return res;
}

export class DriveApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Drive API error ${status}: ${body}`);
    this.name = 'DriveApiError';
  }
}

/* ------------------------------------------------------------------ */
/*  Folder operations                                                  */
/* ------------------------------------------------------------------ */

export interface DriveFolder {
  id: string;
  name: string;
}

/** List folders inside a given parent folder (or root if parentId is 'root'). */
export async function listFolders(
  token: string,
  parentId: string = 'root',
): Promise<DriveFolder[]> {
  const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name)',
    orderBy: 'name',
    pageSize: '100',
  });
  const res = await driveRequest(`${DRIVE_API}/files?${params}`, token);
  const data = await res.json();
  return data.files as DriveFolder[];
}

/** Create a new folder inside a parent folder. Returns the created folder. */
export async function createFolder(
  token: string,
  name: string,
  parentId: string = 'root',
): Promise<DriveFolder> {
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };
  const res = await driveRequest(`${DRIVE_API}/files?fields=id,name`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  const data = await res.json();
  return { id: data.id, name: data.name };
}

/** Get folder name by ID. */
export async function getFolderName(
  token: string,
  folderId: string,
): Promise<string> {
  if (folderId === 'root') return 'My Drive';
  const params = new URLSearchParams({ fields: 'name' });
  const res = await driveRequest(`${DRIVE_API}/files/${folderId}?${params}`, token);
  const data = await res.json();
  return data.name as string;
}

/* ------------------------------------------------------------------ */
/*  File operations                                                    */
/* ------------------------------------------------------------------ */

/** Find an existing .mqda file by name in a folder. Returns file ID or null. */
export async function findFile(
  token: string,
  fileName: string,
  folderId: string,
): Promise<string | null> {
  const q = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
  const params = new URLSearchParams({
    q,
    fields: 'files(id)',
    pageSize: '1',
  });
  const res = await driveRequest(`${DRIVE_API}/files?${params}`, token);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

/** Create a new file in Drive and return the file ID. */
export async function createFile(
  token: string,
  fileName: string,
  folderId: string,
  content: string,
): Promise<string> {
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
  };

  const boundary = '---mqda_boundary';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await driveRequest(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const data = await res.json();
  return data.id as string;
}

/** Update an existing file's content. */
export async function updateFile(
  token: string,
  fileId: string,
  content: string,
): Promise<void> {
  await driveRequest(
    `${UPLOAD_API}/files/${fileId}?uploadType=media`,
    token,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: content,
    },
  );
}

/** Check if a file exists (not trashed). */
export async function fileExists(
  token: string,
  fileId: string,
): Promise<boolean> {
  try {
    const params = new URLSearchParams({ fields: 'id,trashed' });
    const res = await driveRequest(`${DRIVE_API}/files/${fileId}?${params}`, token);
    const data = await res.json();
    return !data.trashed;
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 404) return false;
    throw err;
  }
}
