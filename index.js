const http = require("http");

const server = http.createServer(async (req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("Proxy is running!");
  }

  let targetHost = "";
  let newPath = req.url;

  if (req.url.startsWith("/openrouter")) {
    targetHost = "https://" + "openrouter.ai";
    newPath = req.url.replace(/^\/openrouter/, "");
  } else if (req.url.startsWith("/gemini")) {
    targetHost = "https://" + "://googleapis.com";
    newPath = req.url.replace(/^\/gemini/, "");
  } else if (req.url.startsWith("/groq")) {
    targetHost = "https://" + "://groq.com";
    newPath = req.url.replace(/^\/groq/, "");
  } else {
    res.writeHead(404);
    return res.end("Not found");
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const low = k.toLowerCase();
    if (["authorization", "content-type", "x-api-key", "x-goog-api-key", "anthropic-version", "http-referer", "x-title"].includes(low)) {
      headers[k] = v;
    }
  }
  headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  try {
    const upstream = await fetch(targetHost + newPath, {
      method: req.method,
      headers,
      body: (req.method !== "GET" && req.method !== "HEAD") ? body : undefined
    });
    const respBuf = Buffer.from(await upstream.arrayBuffer());
    const respHeaders = {};
    upstream.headers.forEach((v, k) => {
      if (!["content-encoding", "transfer-encoding", "connection"].includes(k.toLowerCase())) {
        respHeaders[k] = v;
      }
    });
    res.writeHead(upstream.status, respHeaders);
    res.end(respBuf);
  } catch (e) {
    res.writeHead(502);
    res.end(String(e));
  }
});

server.listen(process.env.PORT || 8000, "0.0.0.0", () => {
  console.log("Listening");
});
