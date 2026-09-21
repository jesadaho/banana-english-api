import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  articleHeroObjectPath,
  extensionForHeroMime,
  HERO_MAX_BYTES,
  publicHeroUrl,
} from './article-hero';
import { normalizeArticleSlug, PUBLIC_ARTICLE_WHERE, slugFromTitle } from './article-slug';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  category: true,
  heroImageUrl: true,
  published: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  bodyMarkdown: true,
} as const;

type HeroFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  async listPublic() {
    const articles = await this.prisma.article.findMany({
      where: PUBLIC_ARTICLE_WHERE,
      orderBy: { publishedAt: 'desc' },
      select: {
        slug: true,
        title: true,
        category: true,
        heroImageUrl: true,
        publishedAt: true,
      },
    });
    return { articles };
  }

  async getPublicBySlug(slug: string) {
    const normalized = normalizeArticleSlug(slug);
    if (!normalized) {
      throw new NotFoundException('Article not found');
    }
    const article = await this.prisma.article.findFirst({
      where: { slug: normalized, ...PUBLIC_ARTICLE_WHERE },
      select: {
        slug: true,
        title: true,
        category: true,
        heroImageUrl: true,
        publishedAt: true,
        bodyMarkdown: true,
      },
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return { article };
  }

  async listForAdmin() {
    const articles = await this.prisma.article.findMany({
      orderBy: { updatedAt: 'desc' },
      select: DETAIL_SELECT,
    });
    return { articles };
  }

  async getForAdmin(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: DETAIL_SELECT,
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return { article };
  }

  async create(body: CreateArticleDto) {
    const title = body.title.trim();
    const category = body.category.trim();
    const bodyMarkdown = body.bodyMarkdown.trim();
    const slug = this.requireSlug(body.slug, title);
    const published = body.published === true;
    const publishedAt = parsePublishedAt(body.publishedAt);

    try {
      const article = await this.prisma.article.create({
        data: {
          title,
          slug,
          category,
          bodyMarkdown,
          published,
          publishedAt,
        },
        select: DETAIL_SELECT,
      });
      return { article };
    } catch (error) {
      throwIfSlugConflict(error);
      throw error;
    }
  }

  async update(id: string, body: UpdateArticleDto) {
    await this.requireArticle(id);

    const data: Prisma.ArticleUpdateInput = {};
    if (body.title != null) data.title = body.title.trim();
    if (body.category != null) data.category = body.category.trim();
    if (body.bodyMarkdown != null) data.bodyMarkdown = body.bodyMarkdown.trim();
    if (body.published != null) data.published = body.published;
    if (body.publishedAt != null) data.publishedAt = parsePublishedAt(body.publishedAt);
    if (body.slug != null) {
      const slug = normalizeArticleSlug(body.slug);
      if (!slug) {
        throw new BadRequestException('Slug is required');
      }
      data.slug = slug;
    }

    try {
      const article = await this.prisma.article.update({
        where: { id },
        data,
        select: DETAIL_SELECT,
      });
      return { article };
    } catch (error) {
      throwIfSlugConflict(error);
      throw error;
    }
  }

  async remove(id: string) {
    await this.requireArticle(id);
    await this.prisma.article.delete({ where: { id } });
    return { ok: true };
  }

  async uploadHero(id: string, file: HeroFile | undefined) {
    await this.requireArticle(id);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Hero image is required');
    }
    if (file.size > HERO_MAX_BYTES) {
      throw new BadRequestException('Hero image must be 5MB or smaller');
    }
    const ext = extensionForHeroMime(file.mimetype);
    if (!ext) {
      throw new BadRequestException('Hero image must be jpeg, png, or webp');
    }

    const objectPath = articleHeroObjectPath(id, ext);
    const uploaded = await this.firebase.uploadPublicFile(
      objectPath,
      file.buffer,
      file.mimetype,
    );
    if (!uploaded) {
      throw new ServiceUnavailableException('Hero upload unavailable');
    }

    const heroImageUrl = publicHeroUrl(
      uploaded.bucket,
      objectPath,
      Date.now(),
    );
    const article = await this.prisma.article.update({
      where: { id },
      data: { heroImageUrl },
      select: DETAIL_SELECT,
    });
    return { article };
  }

  private async requireArticle(id: string) {
    const existing = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Article not found');
    }
    return existing;
  }

  private requireSlug(rawSlug: string | undefined, title: string): string {
    const slug = normalizeArticleSlug(rawSlug) || slugFromTitle(title);
    if (!slug) {
      throw new BadRequestException('Slug is required');
    }
    return slug;
  }
}

function parsePublishedAt(raw: string | undefined): Date {
  if (!raw) return new Date();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid publishedAt');
  }
  return date;
}

function throwIfSlugConflict(error: unknown): void {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException('Slug already exists');
  }
}
