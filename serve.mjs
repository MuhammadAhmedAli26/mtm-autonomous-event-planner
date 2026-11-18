import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PORT = process.env.PORT || 3000;
const OUT_DIR = path.resolve(process.cwd(), "out");
const PACKS_DIR = path.resolve(process.cwd(), "packs");
const INBOX_DIR = path.resolve(process.cwd(), "inbox");

function ensureDirs() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(PACKS_DIR)) fs.mkdirSync(PACKS_DIR, { recursive: true });
  if (!fs.existsSync(INBOX_DIR)) fs.mkdirSync(INBOX_DIR, { recursive: true });
}

ensureDirs();

function readJsonSafe(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

function readTextSafe(filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf-8");
  }
  return "";
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const htmlPath = path.resolve(process.cwd(), "ui", "index.html");
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(htmlPath));
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("UI not found. Please verify ui/index.html exists.");
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/data") {
    const plan = readJsonSafe(path.join(OUT_DIR, "plan.json"));
    const traceText = readTextSafe(path.join(OUT_DIR, "trace.txt"));
    const reportText = readTextSafe(path.join(OUT_DIR, "final_report.txt"));
    const state = readJsonSafe(path.resolve(process.cwd(), "state", "state.json"));
    const packFiles = fs.existsSync(PACKS_DIR) ? fs.readdirSync(PACKS_DIR).filter(f => f.endsWith(".txt")) : [];

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      plan,
      traceText,
      reportText,
      messages: state?.messages || [],
      packFiles,
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/message") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { text } = JSON.parse(body);
        if (!text || !text.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Empty message text" }));
        }

        const msgFileName = `msg_${Date.now()}.txt`;
        const msgPath = path.join(INBOX_DIR, msgFileName);
        fs.writeFileSync(msgPath, text.trim(), "utf-8");

        // Run incremental update
        await execFileAsync("node", ["plan.mjs", `inbox/${msgFileName}`]);

        const plan = readJsonSafe(path.join(OUT_DIR, "plan.json"));
        const traceText = readTextSafe(path.join(OUT_DIR, "trace.txt"));
        const state = readJsonSafe(path.resolve(process.cwd(), "state", "state.json"));

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, plan, traceText, messages: state?.messages || [] }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/run-pack") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { file } = JSON.parse(body);
        const targetPath = file.startsWith("packs/") ? file : `packs/${file}`;
        
        await execFileAsync("node", ["plan.mjs", targetPath]);

        const plan = readJsonSafe(path.join(OUT_DIR, "plan.json"));
        const traceText = readTextSafe(path.join(OUT_DIR, "trace.txt"));
        const state = readJsonSafe(path.resolve(process.cwd(), "state", "state.json"));

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, plan, traceText, messages: state?.messages || [] }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/download-report") {
    const reportPath = path.join(OUT_DIR, "final_report.txt");
    if (fs.existsSync(reportPath)) {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="final_report.txt"',
      });
      res.end(fs.readFileSync(reportPath));
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Report file not generated yet.");
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`UI Server running at http://localhost:${PORT}`);
});
