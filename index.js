const http = require("http");
const { Readable } = require("stream");

const server = http.createServer(async (req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("Proxy is running!");
  }

  let targetHost = "";
  let newPath = req.url;

  if (req.url.startsWith("/openrouter")) {
    targetHost = "https://" + "openrouter.ai";
    newPath = urlPath(req.url, "/openrouter");
  } else if (req.url.startsWith("/gemini")) {
    targetHost = "https://" + "generativelanguage" + ".googleapis.com";
    newPath = urlPath(req.url, "/gemini");
  } else if (req.url.startsWith("/groq")) {
    targetHost = "https://" + "api" + ".groq.com";
    newPath = urlPath(req.url, "/groq");
  } else {
    res.writeHead(404);
    return res.end("Not found");
  }

    const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
    if (body && req.url.startsWith("/groq")) {
    try {
      const j = JSON.parse(body.toString("utf8"));
      delete j.include;
      delete j.prompt_cache_key;
      delete j.store;
      if (j.max_tokens && j.max_tokens > 8192) j.max_tokens = 8192;
      body = Buffer.from(JSON.stringify(j));
    } catch {}
  }




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

    const respHeaders = {};
    upstream.headers.forEach((v, k) => {
      if (!["content-encoding", "transfer-encoding", "connection"].includes(k.toLowerCase())) {
        respHeaders[k] = v;
      }
    });

    res.writeHead(upstream.status, respHeaders);
    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (e) {
    res.writeHead(502);
    res.end(String(e));
  }
});

function urlPath(url, prefix) {
  return url.slice(prefix.length) || "/";
}

server.listen(process.env.PORT || 8000, "0.0.0.0", () => {
  console.log("Listening");
});
