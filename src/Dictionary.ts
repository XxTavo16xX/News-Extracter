
// * Dependencies Required

import fs from "fs";
import os from "os";
import pLimit from "p-limit";
import { Worker } from "worker_threads";
import path from "path";

// * Const Required

export const directory_path = "D:\\WDN\\News-Extracter\\news";
const dictionary_worker = "./src/Dictionary-Worker.ts";
const outputDir = "D:\\WDN\\News-Extracter\\dictionary";

class Dictionary_Contructor {

    private static num_Workers: number = 0;
    private static limit = pLimit(1);
    private static total_Files_At_Directory: number = 0;
    private static files_At_Directory: string[] = [];

    public static init() {

        // * Getting Device Specs

        this.load_Device_Specs();

        // * Getting Directory Content

        this.load_Directory_Content();

        console.log(``);
        console.log(``);
        console.log(`Dictionary Constructor will be usign: ${this.num_Workers} cores.`);
        console.log(``);
        console.log(``);
        console.log(`${directory_path} Directory Content Loaded Successfully: ${this.total_Files_At_Directory} Files Found`);
        console.log(``);
        console.log(``);
        console.log(`Starting Parallelism Work`);

        // * Start Parallelistm Processing

        this.start_Parallelism_Work();

    }

    // * Parallelism Processing

    private static load_Device_Specs() {

        this.num_Workers = ((os.cpus().length / 4) * 3);
        this.limit = pLimit(this.num_Workers);

    }

    private static load_Directory_Content() {

        const directoryPath = path.join(directory_path);

        this.files_At_Directory = fs.readdirSync(directoryPath);
        this.total_Files_At_Directory = this.files_At_Directory.length;

    }

    private static async start_Parallelism_Work() {

        const batchSize = this.num_Workers;

        for (let i = 0; i < this.total_Files_At_Directory; i += batchSize) {

            const batch = this.files_At_Directory.slice(i, i + batchSize);

            const batchPromises = batch.map((file, idx) => this.limit(() => this.run_Worker(file, i + idx)));

            await Promise.all(batchPromises);

            console.log(`[Main] Batch ${i / batchSize + 1} completed\n`);

        }

    }

    private static run_Worker(file_path: string, file_path_index: number) {

        return new Promise((resolve, reject) => {

            const worker = new Worker(dictionary_worker, { workerData: { file_path: file_path }, execArgv: ["-r", "ts-node/register"] });

            worker.on("message", (msg) => {

                console.log(`${msg.total_words} words found at file: ${file_path}`);

                if (msg.total_words !== 0) {

                    const outputFile = path.join(outputDir, `news_${file_path_index}.json`);
                    fs.writeFileSync(outputFile, JSON.stringify(msg, null, 2), "utf-8");

                }

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

export default Dictionary_Contructor