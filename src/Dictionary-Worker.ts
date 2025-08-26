
// * Dependencies Required

import { parentPort, workerData } from "worker_threads";
import fs from "fs";
import path from "path";

// * Const required

import { directory_path } from "./Dictionary";

async function read_File_Content(file_Name: string): Promise<{ url: string; lang: string; content: string; }> {

    const file_Path = path.join(directory_path, file_Name);
    const rawData = fs.readFileSync(file_Path, "utf-8");
    return JSON.parse(rawData);

}

async function process_File_Content(json_Data: { url: string, lang: string, content: string }): Promise<{ wordCount: Record<string, number>, total_words: number }> {

    const wordCount: Record<string, number> = {};

    const text: string = json_Data.content || "";
    const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);

    for (const word of words) {
        wordCount[word] = (wordCount[word] || 0) + 1;
    }

    return {wordCount, total_words: words.length};



}

async function process_File(file_Name: string) {

    try {

        console.log(`[Worker] Processing: ${file_Name}`);

        const json_Data = await read_File_Content(file_Name);
        const file_Content_Response = await process_File_Content(json_Data);

        return { url: json_Data.url, lang: json_Data.lang, words: file_Content_Response.wordCount, total_words: file_Content_Response.total_words }



    } catch (error: any) {

        console.error(`[Worker] Error fetching ${file_Name}:`, error.message);
        return { file_Name, error: error.message };

    }

}

(async () => {

    if (!parentPort) return;

    const file_path: string = workerData.file_path;
    const result = await process_File(file_path);

    parentPort.postMessage(result);


})();
