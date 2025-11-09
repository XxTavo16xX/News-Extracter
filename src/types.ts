
// * Dependencies Required

import { ObjectId } from "mongodb";

export interface Indexed_Content_News {
    _id: ObjectId;
    url: string;
    fetched: false
}