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
import {
  ARTICLE_MAX_CLAPS_PER_VISITOR,
  clampClapAmount,
  normalizeVisitorId,
} from './article-engagement';
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
  viewCount: true,
  clapCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  bodyMarkdown: true,
} as const;

const PUBLIC_CARD_SELECT = {
  slug: true,
  title: true,
  category: true,
  heroImageUrl: true,
  publishedAt: true,
  viewCount: true,
  clapCount: true,
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
      select: PUBLIC_CARD_SELECT,
    });
    return { articles };
  }

  async getPublicBySlug(slug: string, visitorIdRaw?: string) {
    const article = await this.requirePublicArticle(slug);
    const visitorId = normalizeVisitorId(visitorIdRaw);
    let myClaps = 0;
    if (visitorId) {
      const engagement = await this.prisma.articleEngagement.findUnique({
        where: {
          articleId_visitorId: {
            articleId: article.id,
            visitorId,
          },
        },
        select: { clapCount: true },
      });
      myClaps = engagement?.clapCount ?? 0;
    }
    return {
      article: {
        slug: article.slug,
        title: article.title,
        category: article.category,
        heroImageUrl: article.heroImageUrl,
        publishedAt: article.publishedAt,
        bodyMarkdown: article.bodyMarkdown,
        viewCount: article.viewCount,
        clapCount: article.clapCount,
      },
      myClaps,
    };
  }

  /** Count one unique view per visitorId (idempotent). */
  async recordView(slug: string, visitorIdRaw: unknown) {
    const visitorId = normalizeVisitorId(visitorIdRaw);
    if (!visitorId) {
      throw new BadRequestException('visitorId is required');
    }
    const article = await this.requirePublicArticle(slug);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.articleEngagement.findUnique({
        where: {
          articleId_visitorId: { articleId: article.id, visitorId },
        },
      });

      if (existing?.viewed) {
        const fresh = await tx.article.findUniqueOrThrow({
          where: { id: article.id },
          select: { viewCount: true, clapCount: true },
        });
        return {
          counted: false,
          viewCount: fresh.viewCount,
          clapCount: fresh.clapCount,
          myClaps: existing.clapCount,
        };
      }

      if (existing) {
        await tx.articleEngagement.update({
          where: { id: existing.id },
          data: { viewed: true },
        });
      } else {
        await tx.articleEngagement.create({
          data: {
            articleId: article.id,
            visitorId,
            viewed: true,
          },
        });
      }

      const updated = await tx.article.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
        select: { viewCount: true, clapCount: true },
      });

      return {
        counted: true,
        viewCount: updated.viewCount,
        clapCount: updated.clapCount,
        myClaps: existing?.clapCount ?? 0,
      };
    });

    return result;
  }

  /** Medium-style claps: up to 50 per visitor per article. */
  async recordClap(slug: string, visitorIdRaw: unknown, amountRaw: unknown) {
    const visitorId = normalizeVisitorId(visitorIdRaw);
    if (!visitorId) {
      throw new BadRequestException('visitorId is required');
    }
    const amount = clampClapAmount(amountRaw);
    const article = await this.requirePublicArticle(slug);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.articleEngagement.findUnique({
        where: {
          articleId_visitorId: { articleId: article.id, visitorId },
        },
      });

      const current = existing?.clapCount ?? 0;
      if (current >= ARTICLE_MAX_CLAPS_PER_VISITOR) {
        const fresh = await tx.article.findUniqueOrThrow({
          where: { id: article.id },
          select: { viewCount: true, clapCount: true },
        });
        return {
          added: 0,
          viewCount: fresh.viewCount,
          clapCount: fresh.clapCount,
          myClaps: current,
        };
      }

      const next = Math.min(ARTICLE_MAX_CLAPS_PER_VISITOR, current + amount);
      const added = next - current;

      if (existing) {
        await tx.articleEngagement.update({
          where: { id: existing.id },
          data: {
            clapCount: next,
            viewed: true,
          },
        });
      } else {
        await tx.articleEngagement.create({
          data: {
            articleId: article.id,
            visitorId,
            viewed: true,
            clapCount: next,
          },
        });
      }

      const shouldCountView = !existing?.viewed;
      const updated = await tx.article.update({
        where: { id: article.id },
        data: {
          clapCount: { increment: added },
          ...(shouldCountView ? { viewCount: { increment: 1 } } : {}),
        },
        select: { viewCount: true, clapCount: true },
      });

      return {
        added,
        viewCount: updated.viewCount,
        clapCount: updated.clapCount,
        myClaps: next,
      };
    });

    return result;
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

  private async requirePublicArticle(slug: string) {
    const normalized = normalizeArticleSlug(slug);
    if (!normalized) {
      throw new NotFoundException('Article not found');
    }
    const article = await this.prisma.article.findFirst({
      where: { slug: normalized, ...PUBLIC_ARTICLE_WHERE },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        heroImageUrl: true,
        publishedAt: true,
        bodyMarkdown: true,
        viewCount: true,
        clapCount: true,
      },
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
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
