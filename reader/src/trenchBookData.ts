import * as fs from 'fs';
import * as path from 'path';

//metadata for a single trench book, as stored in OCdata.json
interface Book {
  author: string;
  date: string;
  'trench-book-images': {
    location: string;
    contents: string[];
  };
}

//OCdata.json maps each book label to its metadata
interface Data {
  [bookLabel: string]: Book;
}

const dataPath = path.join(process.cwd(), 'public', 'OCdata.json');

let jsonData: Data;
try {
  //read the metadata once at startup; it is small and rarely changes
  const rawData = fs.readFileSync(dataPath);
  jsonData = JSON.parse(rawData.toString('utf-8'));
} catch (e) {
  console.error(`Failed to read ${dataPath}:`, e);
  process.exit(1);
}

//true if the given book label exists in the metadata
export function bookExists(label: string): boolean {
  return Object.prototype.hasOwnProperty.call(jsonData, label);
}

//image filenames for a book, or [] if the label is unknown.
//only files that actually exist on disk are returned, 
//without reading any image bytes into memory.
export function listImagesForBook(label: string): string[] {
  const book = jsonData[label];
  if (!book) return [];

  return book['trench-book-images'].contents
    .filter((rel) => fs.existsSync(path.join(process.cwd(), 'public', rel)))
    .map((rel) => path.basename(rel));
}