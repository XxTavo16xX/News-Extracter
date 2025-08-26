
// * Dependencies Required

import fs from "fs";
import os from "os";
import pLimit from "p-limit";
import { Worker } from "worker_threads";
import net from "net";

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


// * Types and Interfaces Required

import { Indexed_News_File_Content } from "./types";
import path from "path";

// * Const Required

const news_file_path = "./src/assets/news.json";
const worker_path = "./src/Worker.ts"
const outputDir = "C:\\Users\\arman\\Documents\\Workspaces\\Web Design Nodes\\News-Extracter\\src\\out";


class News_Extracter {

    private static numWorkers: number = 0;
    private static total_news: number = 0;
    private static limit = pLimit(1);

    private static file_news_content: Indexed_News_File_Content = { content: [] };

    public static init() {

        // * Getting Device Specs

        this.load_Device_Specs();

        // * Reading File

        this.read_File();

        console.log(``);
        console.log(``);
        console.log(`News Extracter will be usign: ${this.numWorkers} cores.`);
        console.log(``);
        console.log(``);
        console.log(`${news_file_path} File Loaded Successfully: ${this.total_news} Sites to procesate`);
        console.log(``);
        console.log(``);
        console.log(`Starting Parallelism Work`);

        this.start_Parallelism_Work();

    }

    // * Parallelism Processing

    private static load_Device_Specs() {

        this.numWorkers = ((os.cpus().length / 4) * 3);
        this.limit = pLimit(this.numWorkers);

    }

    private static read_File() {

        try {

            const file_Content = fs.readFileSync(news_file_path, 'utf-8');

            this.file_news_content = JSON.parse(file_Content);
            this.total_news = this.file_news_content.content.length;

        } catch (error) {

            return console.error('Error reading file: ', error);

        }

    }

    private static async start_Parallelism_Work() {

        const batchSize = this.numWorkers;
        const total = this.file_news_content.content.length;

        for (let i = 0; i < total; i += batchSize) {
            const batch = this.file_news_content.content.slice(i, i + batchSize);

            console.log(`\n[Main] Rotating TOR IP for batch ${i / batchSize + 1}`);
            await rotateTorIP();

            const batchPromises = batch.map((news_data, idx) =>
                this.limit(() => this.run_Worker(news_data.url, i + idx))
            );

            await Promise.all(batchPromises);
            console.log(`[Main] Batch ${i / batchSize + 1} completed\n`);
        }



    }

    private static run_Worker(news_url: string, news_data_index: number): Promise<unknown> {

        return new Promise((resolve, reject) => {

            const worker = new Worker(worker_path, { workerData: { url: news_url }, execArgv: ["-r", "ts-node/register"] });

            worker.on("message", (msg) => {
                const outputFile = path.join(outputDir, `news_${news_data_index}.json`);
                fs.writeFileSync(outputFile, JSON.stringify(msg, null, 2), "utf-8");
                resolve(msg);
            });

            worker.on("error", (err) => {
                console.error("Worker error:", err);
                reject(err);
            });

            worker.on("exit", (code) => {
                if (code !== 0) reject(new Error(`Worker stopped with code ${code}`));
            });

        })

    }



}

News_Extracter.init();