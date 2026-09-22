import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ArticlesService } from './articles.service';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  list() {
    return this.articles.listPublic();
  }

  @Get(':slug')
  getBySlug(
    @Param('slug') slug: string,
    @Query('visitorId') visitorId?: string,
  ) {
    return this.articles.getPublicBySlug(slug, visitorId);
  }

  @Post(':slug/view')
  recordView(
    @Param('slug') slug: string,
    @Body() body: { visitorId?: string },
  ) {
    return this.articles.recordView(slug, body?.visitorId);
  }

  @Post(':slug/clap')
  recordClap(
    @Param('slug') slug: string,
    @Body() body: { visitorId?: string; amount?: number },
  ) {
    return this.articles.recordClap(slug, body?.visitorId, body?.amount);
  }
}
