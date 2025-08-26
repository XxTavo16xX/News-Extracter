import { parentPort, workerData } from "worker_threads";
import axios from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import * as cheerio from "cheerio";
import net from "net";

// TOR Setup
const SOCKS_PROXY = "socks5h://127.0.0.1:9050";
const CONTROL_PORT = 9051;
const CONTROL_PASSWORD = "MiPassword123";


async function rotateTorIP() {
    return new Promise<void>((resolve, reject) => {
        const socket = net.connect(CONTROL_PORT, "127.0.0.1", () => {
            socket.write(`AUTHENTICATE "${CONTROL_PASSWORD}"\r\n`);
            socket.write("SIGNAL NEWNYM\r\n");
            socket.write("QUIT\r\n");
            socket.end();
            resolve();
        });
        socket.on("error", reject);
    });
}

async function fetchPage(url: string, rotate= false) {
    // Rotar IP si ya pasó el intervalo
    if (rotate) await rotateTorIP();

    const agent = new SocksProxyAgent(SOCKS_PROXY);

    const response = await axios.get(url, {
        httpAgent: agent,
        httpsAgent: agent,
        timeout: 20000,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Connection": "keep-alive"
        }
    });

    return response.data;
}

function extractContent(html: string) {
    const $ = cheerio.load(html);
    const lang = $("html").attr("lang") || "unknown";

    // Remove elements that do not add content
    $("script, style, iframe, noscript, header, footer, nav, aside, button, .share, .social").remove();

    // Extract text from paragraphs and headings
    const texts: string[] = [];
    $("p, h1, h2, h3, h4, h5, h6, li").each((_, el) => {
        const txt = $(el).text().trim();
        if (txt) texts.push(txt);
    });

    // Join with line breaks
    const content = texts.join("\n");

    return { lang, content };
}

async function processUrl(url: string) {
    try {
        console.log(`[Worker] Fetching: ${url}`);

        const html = await fetchPage(url);
        const { lang, content } = extractContent(html);

        return { url, lang, content };
    } catch (error: any) {
        console.error(`[Worker] Error fetching ${url}:`, error.message);
        return { url, error: error.message };
    }
}

(async () => {
    if (!parentPort) return;

    const url: string = workerData.url;
    const result = await processUrl(url);
    parentPort.postMessage(result);
})();
