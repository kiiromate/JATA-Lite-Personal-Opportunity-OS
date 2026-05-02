import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { handleApiRequest } from "./operatorApi.js";
import { getProjectPaths } from "../storage/paths.js";

const port = Number(process.env.JATA_API_PORT ?? 4317);
const host = process.env.JATA_API_HOST ?? "127.0.0.1";

const server = createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendJson(response, 400, { error: "Missing request URL." });
      return;
    }

    if (request.method === "OPTIONS") {
      writeCors(response);
      response.writeHead(204);
      response.end();
      return;
    }

    const path = new URL(request.url, `http://${host}:${port}`).pathname;

    if (path.startsWith("/api/")) {
      const apiResponse = await handleApiRequest({
        method: request.method ?? "GET",
        path: request.url,
        body: await readJsonBody(request)
      });

      sendJson(response, apiResponse.status, apiResponse.body);
      return;
    }

    await serveStatic(response, path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`JATA Lite API running at http://${host}:${port}`);
  console.log("Build the web console with `pnpm run build`, then open this URL.");
});

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  return raw ? JSON.parse(raw) : undefined;
}

async function serveStatic(response: ServerResponse, requestPath: string): Promise<void> {
  const root = getProjectPaths().root;
  const staticRoot = join(root, "dist", "web");
  const normalized = normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const relative = normalized === "\\" || normalized === "/" ? "index.html" : normalized.replace(/^[/\\]/, "");
  const filePath = join(staticRoot, relative);

  try {
    const file = await stat(filePath);

    if (!file.isFile()) {
      await sendIndex(response, staticRoot);
      return;
    }

    writeCors(response);
    response.writeHead(200, {
      "content-type": contentType(filePath)
    });
    createReadStream(filePath).pipe(response);
  } catch {
    await sendIndex(response, staticRoot);
  }
}

async function sendIndex(response: ServerResponse, staticRoot: string): Promise<void> {
  const indexPath = join(staticRoot, "index.html");

  try {
    await stat(indexPath);
    writeCors(response);
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    createReadStream(indexPath).pipe(response);
  } catch {
    sendJson(response, 404, {
      error:
        "Web console build not found. Run `pnpm run build`, or use `pnpm start:web` for Vite dev mode."
    });
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  writeCors(response);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function writeCors(response: ServerResponse): void {
  response.setHeader("access-control-allow-origin", "http://127.0.0.1:5173");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function contentType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".js") {
    return "text/javascript; charset=utf-8";
  }

  if (extension === ".css") {
    return "text/css; charset=utf-8";
  }

  if (extension === ".svg") {
    return "image/svg+xml";
  }

  if (extension === ".html") {
    return "text/html; charset=utf-8";
  }

  return "application/octet-stream";
}
