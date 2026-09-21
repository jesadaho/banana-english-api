import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { HERO_MAX_BYTES } from '../articles/article-hero';
import { ArticlesService } from '../articles/articles.service';
import { CreateArticleDto } from '../articles/dto/create-article.dto';
import { UpdateArticleDto } from '../articles/dto/update-article.dto';
import { AdminAuthGuard } from './admin-auth.guard';

@Controller('admin/articles')
@UseGuards(AdminAuthGuard)
export class AdminArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  list() {
    return this.articles.listForAdmin();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.articles.getForAdmin(id);
  }

  @Post()
  create(@Body() body: CreateArticleDto) {
    return this.articles.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateArticleDto) {
    return this.articles.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articles.remove(id);
  }

  @Post(':id/hero')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: HERO_MAX_BYTES },
    }),
  )
  uploadHero(
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.articles.uploadHero(id, file);
  }
}
