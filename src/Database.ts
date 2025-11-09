
// * Dependencies Required

import { MongoClient, Collection, Document } from "mongodb"

class Database {

    private static instance: Database | null = null;
    private client: MongoClient | null = null;
    private connected: boolean = false;


    public static async init(mongoUrl?: string) {

        if (!Database.instance) {

            Database.instance = new Database();
            await Database.instance._connect(mongoUrl);

        }

        return Database.instance;

    }

    public static get_Instance(): Database {
        if (!Database.instance) throw new Error("Database not initialized. Call Database.init() first.");
        return Database.instance;
    }

    constructor() { }

    private async _connect(mongoUrl?: string) {

        if (this.connected) return;
        const url = mongoUrl || process.env.MONGODB_URL;
        if (!url) throw new Error("MONGODB_URL not defined");
        this.client = new MongoClient(url, { maxPoolSize: 20 });
        await this.client.connect();
        this.connected = true;
        console.log("Database connected");

    }

    public async get_Connection(database_name: string, collection_name: string): Promise<Collection<Document>> {

        if (!this.client) throw new Error("MongoClient not initialized");
        const db = this.client.db(database_name);
        return db.collection(collection_name);

    }

    public async close(): Promise<void> {
        if (this.client) {
            try {
                await this.client.close();
                this.connected = false;
                console.log("Database connection closed");
            } catch (e) {
                console.warn("Error closing DB connection:", e);
            }
        }
    }

}

export default Database