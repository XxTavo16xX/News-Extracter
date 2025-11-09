
// * Dependencies Required

import { parentPort, workerData } from "worker_threads";
import axios, { AxiosError } from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import { ObjectId } from "mongodb";
import * as cheerio from "cheerio";

// * Module Required

import TOR_Network_Controller from "./Tor";
import Database from "./Database";

// * Worker Methods

(async () => {

    if (!parentPort) return;

    const id = new ObjectId(workerData._id);
    const url: string = workerData.url;

    console.log(`[${id.toString()}:Worker] Initialized`);

    try {

        const result = await process_Web_Page(id, url);
        parentPort.postMessage(result);

    } catch (error) {

        console.error(`[${id.toString()}:Worker] Fatal error:`, error);
        parentPort.postMessage({ fetched: false, saved: false, error: error });

    }

})();

function process_Web_Page(id: ObjectId, url: string): Promise<{ fetched: boolean, saved: boolean }> {

    return new Promise(async (resolve, reject) => {

        try {

            const html_fetched = await fetchPage(id, url);

            if (html_fetched.fetched === false || html_fetched.data === null) return resolve({ fetched: false, saved: false });

            const save_result = await save_HTML_Fetched(id, url, html_fetched);

            return resolve({ fetched: true, saved: save_result.saved });

        } catch (error: any) {

            console.error(`[Worker] Error fetching ${url}:`, error.message);

            return reject(error);

        }

    })

}


function fetchPage(id: ObjectId, url: string, rotate = false): Promise<{ fetched: boolean, data: any }> {

    return new Promise(async (resolve, reject) => {

        try {

            console.log(`[${id.toString()}:Worker] Fetching: ${url}`);

            if (rotate) await TOR_Network_Controller.rotateTorIP();

            const agent = new SocksProxyAgent(process.env.SOCKS_PROXY as string);
            const agent_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
                "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Connection": "keep-alive"
            }

            const response = await axios.get(url, { httpAgent: agent, httpsAgent: agent, timeout: 20000, headers: agent_headers });

            console.log(`[${id.toString()}:Worker] Fetch Result: ${response.status}`);

            if (response.status >= 200 && response.status <= 299) {

                return resolve({ fetched: true, data: response.data });

            } else {

                return resolve({ fetched: false, data: null });

            }

        } catch (error) {

            if (axios.isAxiosError(error)) {

                const axiosError = error as AxiosError;
                if (axiosError.response) {
                    console.warn(`[${id.toString()}:Worker] HTTP ${axiosError.response.status} for ${url}`);
                    return { fetched: false, data: null };
                }

            } else {

                return reject(error);

            }

        }

    })
}

function save_HTML_Fetched(id: ObjectId, url: string, fetched_html: any): Promise<{ saved: boolean }> {

    return new Promise(async (resolve, reject) => {

        try {

            console.log(`[${id.toString()}:Worker] Extracting Fetched Web Page Content: ${url}`);

            const { lang, content } = extractContent(fetched_html);

            if (lang !== "unknown" && content != "") {

                console.log(`[${id.toString()}:Worker] Saving Extracted Fetched Web Page Content: ${url}`);

                const newsAt_Indexed_Content = await Database.get_Connection(process.env.fetched_Content as string, process.env.fetched_Content_News_Collection as string);
                const saveResult = await newsAt_Indexed_Content.insertOne({ _id: id, url, lang, content });
                console.log(`[${id.toString()}:Worker] Status Extracted Fetched Web Page Content ${saveResult.acknowledged === true ? "saved successfully" : "wasn't saved"}`);

                return resolve({ saved: saveResult.acknowledged });

            } else {

                return resolve({ saved: false })

            }

        } catch (error) {

            return reject(error);

        }

    })

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