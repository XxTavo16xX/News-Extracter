
export interface Indexed_New {
    _id: string;
    title: string;
    description: string;
    image: string;
    url: string;
    domain: string;
    lastmod: number;
    views: number;
    _type: "log";
}

export type Indexed_News_File_Content = { content: Indexed_New[] }

export interface ExtractedDoc {
    url: string;
    lang: string | null;
    content: string;
    fetchedAt: string;
    status: number;
}