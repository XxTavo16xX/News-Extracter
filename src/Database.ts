
// * Dependencies Required

import { MongoClient, Collection, Document } from "mongodb"

class Database {

    private static Database_Instance: Database;

    public static get_Connection(database_name: string, collection_name: string): Promise<Collection<Document>> {

        if (!Database.Database_Instance) {

            Database.Database_Instance = new Database();

        }

        return Database.Database_Instance.get_Connection(database_name, collection_name);

    }

    private client_Connection: MongoClient;

    constructor() {

        this.client_Connection = new MongoClient(process.env.MONGODB_URL as string);

    }

    public get_Connection(database_name: string, collection_name: string): Promise<Collection<Document>> {

        return new Promise((resolve, reject) => {

            try {

                const db = this.client_Connection.db(database_name);
                const collection = db.collection(collection_name);

                return resolve(collection);

            } catch (error) {

                return reject(error);

            }

        })

    }


}

export default Database