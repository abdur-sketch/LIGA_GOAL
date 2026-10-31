import { createHash } from "node:crypto";
import { createServer } from "node:http";

const host = process.env.CI_S3_HOST || "127.0.0.1";
const port = Number(process.env.CI_S3_PORT || "4569");
const buckets = new Map();

function xmlEscape(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function send(response, status, body = "", headers = {}) {
  response.writeHead(status, { "content-length": Buffer.byteLength(body), ...headers });
  response.end(body);
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function parseTarget(request) {
  const url = new URL(request.url || "/", `http://${host}:${port}`);
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  return { url, bucket: segments.shift() || "", key: segments.join("/") };
}

const server = createServer(async (request, response) => {
  try {
    const { url, bucket, key } = parseTarget(request);
    if (url.pathname === "/health") return send(response, 200, "ok", { "content-type": "text/plain" });
    if (!bucket) return send(response, 400);

    if (!key && request.method === "HEAD") return send(response, buckets.has(bucket) ? 200 : 404);
    if (!key && request.method === "PUT") {
      if (!buckets.has(bucket)) buckets.set(bucket, new Map());
      return send(response, 200);
    }
    if (!buckets.has(bucket)) return send(response, 404);
    const objects = buckets.get(bucket);

    if (!key && request.method === "GET" && url.searchParams.get("list-type") === "2") {
      const prefix = url.searchParams.get("prefix") || "";
      const contents = [...objects.entries()]
        .filter(([objectKey]) => objectKey.startsWith(prefix))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([objectKey, value]) => `<Contents><Key>${xmlEscape(objectKey)}</Key><LastModified>${value.modified}</LastModified><ETag>&quot;${value.etag}&quot;</ETag><Size>${value.body.length}</Size><StorageClass>STANDARD</StorageClass></Contents>`)
        .join("");
      const body = `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${xmlEscape(bucket)}</Name><Prefix>${xmlEscape(prefix)}</Prefix><KeyCount>${contents ? [...objects.keys()].filter((objectKey) => objectKey.startsWith(prefix)).length : 0}</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`;
      return send(response, 200, body, { "content-type": "application/xml" });
    }

    if (request.method === "PUT") {
      const copySource = request.headers["x-amz-copy-source"];
      let body;
      if (typeof copySource === "string") {
        const [sourceBucket, ...sourceKeyParts] = decodeURIComponent(copySource.replace(/^\//, "")).split("/");
        const source = buckets.get(sourceBucket)?.get(sourceKeyParts.join("/"));
        if (!source) return send(response, 404);
        body = Buffer.from(source.body);
      } else {
        body = await requestBody(request);
      }
      const etag = createHash("md5").update(body).digest("hex");
      const modified = new Date().toISOString();
      objects.set(key, { body, etag, modified });
      if (copySource) {
        const result = `<?xml version="1.0" encoding="UTF-8"?><CopyObjectResult><LastModified>${modified}</LastModified><ETag>&quot;${etag}&quot;</ETag></CopyObjectResult>`;
        return send(response, 200, result, { "content-type": "application/xml" });
      }
      return send(response, 200, "", { etag: `"${etag}"` });
    }
    if (request.method === "GET") {
      const object = objects.get(key);
      if (!object) return send(response, 404);
      response.writeHead(200, { "content-length": object.body.length, etag: `"${object.etag}"` });
      return response.end(object.body);
    }
    if (request.method === "DELETE") {
      objects.delete(key);
      return send(response, 204);
    }
    return send(response, 405);
  } catch (error) {
    console.error("S3 emulator request failed", error);
    return send(response, 500);
  }
});

server.listen(port, host, () => console.log(`Local S3 emulator listening on http://${host}:${port}`));

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
