
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
    private static limit: ReturnType<typeof pLimit> = pLimit(1);
    private static activeWorkers: Set<Worker> = new Set();

    public static async init() {

        // * Initializing Database Connection

        await Database.init(process.env.MONGODB_URL as string);

        // * Getting Device Specs

        this.load_Device_Specs();

        // * Reading File

        await this.get_URLs_To_Fetch_List();

        // graceful shutdown
        process.on("SIGINT", async () => { console.log("SIGINT received, shutting down..."); await this.shutdown(); process.exit(0); });
        process.on("SIGTERM", async () => { console.log("SIGTERM received, shutting down..."); await this.shutdown(); process.exit(0); });

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

            const db = Database.get_Instance();
            const newsAt_Indexed_Content = await db.get_Connection(process.env.indexed_Content as string, process.env.indexed_Content_News_Collection as string);

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

            const db = Database.get_Instance();
            const newsAt_Indexed_Content = await db.get_Connection(process.env.indexed_Content as string, process.env.indexed_Content_News_Collection as string);
            const unfetched_webpages = await newsAt_Indexed_Content.find<Indexed_Content_News>({ fetched: false, $or: [{ failed: { $exists: false } }, { failed: false }] }).sort({ _id: -1 }).limit(batchSize).toArray();

            if (unfetched_webpages.length === 0) break;

            const batchPromises = unfetched_webpages.map((news_data, idx) =>
                this.limit(() => this.run_Worker(news_data))
            );

            await Promise.all(batchPromises);

            console.log(`Batch completed, checking for remaining pages...`);

        }

        console.log(`All pages fetched!`);
        await this.shutdown();

    }

    private static run_Worker(unfetched_webpage: Indexed_Content_News): Promise<unknown> {

        return new Promise((resolve, reject) => {

            const worker = new Worker(worker_path, { workerData: { ...unfetched_webpage, _id: unfetched_webpage._id.toString() }, execArgv: ["-r", "ts-node/register"] });

            try { worker.unref(); } catch (e) { /* no-op if not supported */ }
            this.activeWorkers.add(worker);

            const cleanup = () => {
                this.activeWorkers.delete(worker);
                try {
                    // attempt terminate in case worker is still alive
                    worker.terminate().catch(() => { /* ignore */ });
                } catch (e) { /* ignore */ }
            };

            const onMessage = async (msg: { fetched: boolean, saved: boolean, error?: unknown }) => {

                try {

                    if (msg.fetched === false) {

                        console.log(`[Worker:${unfetched_webpage._id}] Unable to Fetch Web page content. (Blocked by website)`);

                        const db = Database.get_Instance();
                        const newsAt_Indexed_Content = await db.get_Connection(process.env.indexed_Content as string, process.env.indexed_Content_News_Collection as string);

                        await newsAt_Indexed_Content.updateOne({ _id: unfetched_webpage._id }, { $set: { failed: true } });

                    } else if (msg.saved === true) {

                        console.log(`[Worker:${unfetched_webpage._id}] Fetched Successfully.`);

                        const db = Database.get_Instance();
                        const newsAt_Indexed_Content = await db.get_Connection(process.env.indexed_Content as string, process.env.indexed_Content_News_Collection as string);

                        await newsAt_Indexed_Content.updateOne({ _id: unfetched_webpage._id }, { $set: { fetched: true, failed: false } });

                        this.total_unfetched_pages = Math.max(this.total_unfetched_pages - 1, 0);

                        console.log(`[Worker:${unfetched_webpage._id}] Completed. Remaining pages: ${this.total_unfetched_pages}`);

                    } else {

                        console.log(`[Worker:${unfetched_webpage._id}] Unable to Fetch Web page content.`);

                    }

                    resolve(msg);

                } catch (error) {

                    reject(error);

                } finally {
                    worker.removeAllListeners();
                    cleanup();
                }

            }

            const onError = (err: any) => {

                console.error("Worker error:", err);

                worker.removeAllListeners();
                cleanup();
                reject(err);

            }

            const onExit = (code: number) => {

                if (code !== 0) {

                    const err = new Error(`Worker stopped with code ${code}`);
                    cleanup();
                    reject(err);

                } else {

                    cleanup();

                }

            }

            worker.on("message", onMessage);
            worker.on("error", onError);
            worker.on("exit", onExit);

        })

    }

    private static async shutdown() {

        console.log("Shutting down News_Extracter...");
        // terminate active workers
        for (const w of Array.from(this.activeWorkers)) {
            try {

                await w.terminate();

            } catch (e) { /* ignore */ }
        }

        this.activeWorkers.clear();

        // close DB
        try {

            const db = Database.get_Instance();
            await db.close();

        } catch (e) {

            console.warn("Database close error (may be uninitialized):", e);

        }

        console.log("Shutdown complete.");
        
    }


}

export default News_Extracter