const MAX_SLUG_LENGTH = 80;

export const PUBLIC_ARTICLE_WHERE = { published: true } as const;

export function isPublicArticle(article: { published: boolean }): boolean {
  return article.published === true;
}

export function normalizeArticleSlug(raw: string | undefined | null): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u0e00-\u0e7f-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
}

export function slugFromTitle(title: string | undefined | null): string {
  return normalizeArticleSlug(title);
}
