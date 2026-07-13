export interface SeriesConfig {
  seriesId: string;
  titleEn: string;
  titleTh: string;
  subtitleTh: string;
  order: number;
  coverImage: string;
  missionIds: string[];
}

export const SERIES: SeriesConfig[] = [
  {
    seriesId: 'everyday_english',
    titleEn: 'Everyday English',
    titleTh: 'ภาษาอังกฤษในชีวิตประจำวัน',
    subtitleTh: 'ฝึกพูดในสถานการณ์ที่เจอทุกวัน',
    order: 0,
    coverImage: 'category_daily_life',
    missionIds: [
      'coffee_order_easy',
      'movie_tickets_easy',
      'pharmacy_easy',
    ],
  },
  {
    seriesId: 'travel_essentials',
    titleEn: 'Travel Essentials',
    titleTh: 'อังกฤษสำหรับการเดินทาง',
    subtitleTh: 'พูดคุยได้มั่นใจเมื่อออกไปเที่ยว',
    order: 1,
    coverImage: 'category_travel',
    missionIds: ['hotel_checkin_easy', 'business_meeting_easy'],
  },
];

export function getAllSeries(): SeriesConfig[] {
  return [...SERIES].sort((a, b) => a.order - b.order);
}

export function getSeriesById(seriesId: string): SeriesConfig | undefined {
  return SERIES.find((s) => s.seriesId === seriesId);
}

export function getSeriesForSimulation(
  simulationId: string,
): SeriesConfig | undefined {
  return SERIES.find((s) => s.missionIds.includes(simulationId));
}

export function getPreviousSeries(
  series: SeriesConfig,
): SeriesConfig | undefined {
  return SERIES.find((s) => s.order === series.order - 1);
}
