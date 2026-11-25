import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const requestedPath = resolve(root, `.${pathname}`);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (requestedPath !== root && !requestedPath.toLowerCase().startsWith(rootPrefix.toLowerCase())) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const filePath = requestedPath === root ? join(root, "index.html") : requestedPath;
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store"
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    console.error("Could not serve the requested file.", error);
    response.writeHead(500);
    response.end("Server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Clinical Evidence Explorer running at http://127.0.0.1:${port}`);
  console.log("Press Ctrl+C to stop.");
});
