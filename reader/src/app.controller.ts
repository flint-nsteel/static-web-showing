import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { TrenchBookService } from './app.service';

@Controller('trench-book')
export class AppController {
  constructor(private readonly trenchBookService: TrenchBookService) {}

  //POST /trench-book/load
  //validates the requested book exists and returns a status string.
  //kept for frontend compatibility; it no longer loads bytes into memory.
  @Post('load')
  loadBook(@Body() body: { bookLabel: string }): string {
    return this.trenchBookService.describeBook(body.bookLabel);
  }

  //GET /trench-book/list-images?bookLabel=...
  //returns the image filenames for any book, independent of other requests.
  @Get('list-images')
  listImages(@Query('bookLabel') bookLabel: string): string[] {
    if (!bookLabel) return [];
    return this.trenchBookService.listImages(bookLabel);
  }
}