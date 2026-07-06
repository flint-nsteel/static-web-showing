import { Injectable } from '@nestjs/common';
import { bookExists, listImagesForBook } from './trenchBookData';

@Injectable()
export class TrenchBookService {
  //returns the image filenames for a book, or [] if the label is unknown.
  //stateless: any number of books can be queried at once without one
  //request evicting another's data.
  listImages(label: string): string[] {
    return listImagesForBook(label);
  }

  //validates that a book exists and reports its image count.
  //retained so the existing frontend's POST /load call still gets a
  //sensible status string; it no longer loads anything into memory.
  describeBook(label: string): string {
    if (!bookExists(label)) {
      return `Failed to load "${label}": not found`;
    }
    const count = listImagesForBook(label).length;
    return `Book "${label}" ready with ${count} images`;
  }

  //true if the book exists in the metadata
  isBookLoaded(label: string): boolean {
    return bookExists(label);
  }
}