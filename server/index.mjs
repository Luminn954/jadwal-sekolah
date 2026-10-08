import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { createScheduleStore, validateProfiles } from "./store.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const host = process.env.HOST ?? "0.0.0.0";
const dataRoot = process.env.JADWAL_DATA_DIR ?? resolve(root, "data");
const store = createScheduleStore(resolve(dataRoot, "schedules.json"));
let snapshot = await store.load();
let writeQueue = Promise.resolve();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2"
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function getLanUrls() {
  const addresses = new Set();
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if ((item.family === "IPv4" || item.family === 4) &&
        !item.internal &&
        !item.address.startsWith("169.254.")) {
        addresses.add("http://" + item.address + ":" + port);
      }
    }
  }
  return [...addresses].sort();
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        rejectBody(new Error("Ukuran data jadwal terlalu besar."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(body));
      } catch {
        rejectBody(new Error("Isi permintaan bukan JSON yang valid."));
      }
    });
    request.on("error", rejectBody);
  });
}

async function saveSchedules(payload) {
  const operation = writeQueue.then(async () => {
    if (!payload || !Number.isInteger(payload.revision) || !Array.isArray(payload.profiles)) {
      return { status: 400, result: { error: "Format jadwal tidak valid." } };
    }
    if (payload.revision !== snapshot.revision) {
      return { status: 409, result: { error: "Jadwal sudah berubah di perangkat lain." } };
    }
    const validationError = validateProfiles(payload.profiles);
    if (validationError) return { status: 400, result: { error: validationError } };

    const next = {
      revision: snapshot.revision + 1,
      profiles: payload.profiles
    };
    await store.write(next);
    snapshot = next;
    return { status: 200, result: snapshot };
  });
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

async function serveStatic(requestPath, response) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    response.writeHead(400);
    response.end("Alamat tidak valid.");
    return;
  }
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  let filePath = resolve(dist, relativePath);
  const fromDist = relative(dist, filePath);
  if (fromDist.startsWith(".." + sep) || fromDist === ".." || resolve(filePath) === resolve(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    await access(filePath);
  } catch {
    if (!extname(decodedPath)) {
      filePath = resolve(dist, "index.html");
      try {
        await access(filePath);
      } catch {
        response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("App belum dibuild. Jalankan npm run build.");
        return;
      }
    } else {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
  }
  response.writeHead(200, {
    "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
    "Content-Type": mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff"
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const method = request.method ?? "GET";
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

  if (pathname === "/api/health" && method === "GET") {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (pathname === "/api/info" && method === "GET") {
    sendJson(response, 200, {
      localUrl: "http://localhost:" + port,
      lanUrls: getLanUrls()
    });
    return;
  }
  if (pathname === "/api/schedules" && method === "GET") {
    sendJson(response, 200, snapshot);
    return;
  }
  if (pathname === "/api/schedules" && method === "PUT") {
    try {
      const payload = await readJsonBody(request);
      const saved = await saveSchedules(payload);
      sendJson(response, saved.status, saved.result);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Data jadwal tidak bisa dibaca." });
    }
    return;
  }
  if (pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "API tidak ditemukan." });
    return;
  }
  if (method !== "GET" && method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  await serveStatic(pathname, response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error("Port " + port + " sedang dipakai. Tutup server lain atau atur PORT.");
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log("Jadwal Kelas berjalan di http://localhost:" + port);
  const lanUrls = getLanUrls();
  if (lanUrls.length) console.log("Buka dari HP di Wi-Fi yang sama: " + lanUrls.join(", "));
  console.log("File jadwal: " + resolve(dataRoot, "schedules.json"));
});
