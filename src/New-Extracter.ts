
// * Dependencies Required

import path from "path";
import fs from "fs";
import os from "os";
import pLimit from "p-limit";
import { Worker } from "worker_threads";

// * Modules Required

import Database from "./Database";

// * Types and Interfaces Required

import { Indexed_Content_News } from "./types";

// * Const Required

const worker_path = process.env.WORKER_PATH as string;
const outputDir = process.env.NEWS_FILES_OUTPUT_PATH as string;

// * Exported Module 

class News_Extracter {

    private static numWorkers: number = 0;
    private static total_unfetched_pages: number = 0;
    private static limit = pLimit(1);

    public static async init() {

        // * Getting Device Specs

        this.load_Device_Specs();

        // * Reading File

        await this.get_URLs_To_Fetch_List();

        // * Initializing Fetch Process

        this.start_Parallelism_Work();

    }

    // * Parallelism Processing

    private static load_Device_Specs() {

        this.numWorkers = ((os.cpus().length / 4) * 3);
        this.limit = pLimit(this.numWorkers);

        console.log(``);
        console.log(`News Extracter will be usign: ${this.numWorkers} cores.`);
        console.log(``);

    }

    private static async get_URLs_To_Fetch_List() {

        try {

            const newsAt_Indexed_Content = await Database.get_Connection(process.env.indexed_Content as string, process.env.indexed_Content_News_Collection as string);

            this.total_unfetched_pages = await newsAt_Indexed_Content.countDocuments({ fetched: false });

            console.log(``);
            console.log(`${this.total_unfetched_pages} Unfetched Web Pages Found at DB.`);
            console.log(``);

        } catch (error) {

            return console.error('Error reading file: ', error);

        }

    }

    private static async start_Parallelism_Work() {

        console.log(``);
        console.log(`Starting Parallelism Work`);
        console.log(``);

        const batchSize = this.numWorkers;

        while (true) {

            const newsAt_Indexed_Content = await Database.get_Connection(process.env.indexed_Content as string, process.env.indexed_Content_News_Collection as string);
            const unfetched_webpages = await newsAt_Indexed_Content.find<Indexed_Content_News>({ fetched: false, failed: false }).sort({ _id: -1 }).limit(batchSize).toArray();

            if (unfetched_webpages.length === 0) break;

            const batchPromises = unfetched_webpages.map((news_data, idx) =>
                this.limit(() => this.run_Worker(news_data))
            );

            await Promise.all(batchPromises);

            console.log(`Batch completed, checking for remaining pages...`);

        }

        console.log(`All pages fetched!`);

    }

    private static run_Worker(unfetched_webpage: Indexed_Content_News): Promise<unknown> {

        return new Promise((resolve, reject) => {

            const worker = new Worker(worker_path, { workerData: { ...unfetched_webpage, _id: unfetched_webpage._id.toString() }, execArgv: ["-r", "ts-node/register"] });

            worker.on("message", async (msg: { fetched: boolean, saved: boolean, error?: unknown }) => {

                if (msg.fetched === false) {

                    console.log(`[Worker:${unfetched_webpage._id}] Unable to Fetch Web page content. (Blocked by website)`);

                    const newsAt_Indexed_Content = await Database.get_Connection(process.env.indexed_Content as string, process.env.indexed_Content_News_Collection as string);

                    await newsAt_Indexed_Content.updateOne({ _id: unfetched_webpage._id }, { $set: { failed: true } });

                } else if (msg.saved === true) {

                    console.log(`[Worker:${unfetched_webpage._id}] Fetched Successfully.`);

                    const newsAt_Indexed_Content = await Database.get_Connection(process.env.indexed_Content as string, process.env.indexed_Content_News_Collection as string);

                    await newsAt_Indexed_Content.updateOne({ _id: unfetched_webpage._id }, { $set: { fetched: true, failed: false } });

                    this.total_unfetched_pages = Math.max(this.total_unfetched_pages - 1, 0);

                    console.log(`[Worker:${unfetched_webpage._id}] Completed. Remaining pages: ${this.total_unfetched_pages}`);                    

                } else {

                    console.log(`[Worker:${unfetched_webpage._id}] Unable to Fetch Web page content.`);

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

export default News_Extracter