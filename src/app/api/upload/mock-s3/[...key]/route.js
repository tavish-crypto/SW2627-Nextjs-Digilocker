import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const mockStorageRoot = path.join(process.cwd(), ".mock-storage");

function isMockStorageAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.MOCK_API_ENABLED === "true";
}

function mockStorageDisabledResponse() {
  return Response.json(
    { error: "Mock filesystem storage is disabled in production. Use STORAGE_PROVIDER=database, gcp, or s3." },
    { status: 503 }
  );
}

function getObjectKey(params) {
  const resolvedParams = params || {};
  return Array.isArray(resolvedParams.key)
    ? resolvedParams.key.join("/")
    : resolvedParams.key || "unknown";
}

function getContentType(key) {
  const extension = key.split(".").pop()?.toLowerCase();
  return {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    json: "application/json",
    xml: "application/xml",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }[extension] || "application/octet-stream";
}

function getStoragePaths(key) {
  const normalizedKey = key.replace(/\\/g, "/");
  if (!normalizedKey.startsWith("uploads/") || normalizedKey.includes("..")) {
    throw new Error("Invalid mock storage key");
  }

  const dataPath = path.resolve(mockStorageRoot, normalizedKey);
  const rootPath = path.resolve(mockStorageRoot);
  if (!dataPath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error("Invalid mock storage path");
  }

  return {
    dataPath,
    metadataPath: `${dataPath}.meta.json`,
  };
}

/**
 * PUT /api/upload/mock-s3/[...key]
 * 
 * Mock endpoint simulating direct cloud storage (e.g. S3 PUT) for development
 * and automated testing environments.
 */
export async function PUT(request, { params }) {
  if (!isMockStorageAllowed()) return mockStorageDisabledResponse();
  const resolvedParams = await params;
  const key = getObjectKey(resolvedParams);

  try {
    const arrayBuffer = await request.arrayBuffer();
    const { dataPath, metadataPath } = getStoragePaths(key);
    await mkdir(path.dirname(dataPath), { recursive: true });
    await writeFile(dataPath, Buffer.from(arrayBuffer));
    await writeFile(
      metadataPath,
      JSON.stringify({
        contentType: request.headers.get("content-type") || getContentType(key),
      })
    );

    return new Response(null, {
      status: 200,
      headers: {
        "ETag": `"${Date.now().toString(16)}"`,
        "Content-Length": String(arrayBuffer.byteLength),
      },
    });
  } catch (error) {
    console.error("Mock storage upload failed:", error);
    return Response.json({ error: "Failed to store uploaded file" }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  if (!isMockStorageAllowed()) return mockStorageDisabledResponse();
  try {
    const key = getObjectKey(await params);
    const { dataPath, metadataPath } = getStoragePaths(key);
    const [body, metadata] = await Promise.all([
      readFile(dataPath),
      readFile(metadataPath, "utf8").catch(() => "{}"),
    ]);

    let requestedDisposition = "inline";
    let requestedContentType = null;
    try {
      if (request?.url) {
        const url = new URL(request.url);
        requestedDisposition =
          url.searchParams.get("disposition") ||
          url.searchParams.get("response-content-disposition") ||
          "inline";
        requestedContentType =
          url.searchParams.get("contentType") ||
          url.searchParams.get("response-content-type");
      }
    } catch {
      // Ignore URL parsing errors
    }

    const contentType = requestedContentType || JSON.parse(metadata).contentType || getContentType(key);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        "Content-Disposition": requestedDisposition,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("File not found", { status: 404 });
  }
}

export async function HEAD(_request, { params }) {
  if (!isMockStorageAllowed()) return mockStorageDisabledResponse();
  try {
    const key = getObjectKey(await params);
    const { dataPath, metadataPath } = getStoragePaths(key);
    const [fileStats, metadata] = await Promise.all([
      stat(dataPath),
      readFile(metadataPath, "utf8").catch(() => "{}"),
    ]);
    const contentType = JSON.parse(metadata).contentType || getContentType(key);

    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileStats.size),
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
