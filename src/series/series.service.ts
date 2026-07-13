import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getAllSeries,
  getPreviousSeries,
  getSeriesById,
  SeriesConfig,
} from './series.data';

export interface SeriesMissionView {
  simulationId: string;
  order: number;
  isCompleted: boolean;
}

export interface SeriesView {
  seriesId: string;
  titleEn: string;
  titleTh: string;
  subtitleTh: string;
  order: number;
  coverImage: string;
  isUnlocked: boolean;
  isCompleted: boolean;
  completedMissions: number;
  totalMissions: number;
  currentSimulationId: string | null;
  missions: SeriesMissionView[];
}

@Injectable()
export class SeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompletedSimulationIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.userSession.findMany({
      where: {
        userId,
        rewardsApplied: true,
        simulationId: { not: null },
      },
      select: { simulationId: true },
      distinct: ['simulationId'],
    });

    return new Set(
      rows
        .map((r) => r.simulationId)
        .filter((id): id is string => id != null),
    );
  }

  private buildSeriesView(
    series: SeriesConfig,
    completedIds: Set<string>,
    previousCompleted: boolean,
  ): SeriesView {
    const isUnlocked = series.order === 0 || previousCompleted;
    const missions: SeriesMissionView[] = series.missionIds.map(
      (simulationId, index) => ({
        simulationId,
        order: index + 1,
        isCompleted: completedIds.has(simulationId),
      }),
    );

    const completedMissions = missions.filter((m) => m.isCompleted).length;
    const totalMissions = missions.length;
    const isCompleted =
      isUnlocked && completedMissions === totalMissions && totalMissions > 0;

    const currentMission = isUnlocked
      ? missions.find((m) => !m.isCompleted)
      : undefined;

    return {
      seriesId: series.seriesId,
      titleEn: series.titleEn,
      titleTh: series.titleTh,
      subtitleTh: series.subtitleTh,
      order: series.order,
      coverImage: series.coverImage,
      isUnlocked,
      isCompleted,
      completedMissions,
      totalMissions,
      currentSimulationId: currentMission?.simulationId ?? null,
      missions,
    };
  }

  async getAllForUser(userId: string): Promise<SeriesView[]> {
    const completedIds = await this.getCompletedSimulationIds(userId);
    const catalog = getAllSeries();
    const views: SeriesView[] = [];

    for (const series of catalog) {
      const prev = getPreviousSeries(series);
      const previousCompleted = prev
        ? views.find((v) => v.seriesId === prev.seriesId)?.isCompleted ?? false
        : true;

      views.push(this.buildSeriesView(series, completedIds, previousCompleted));
    }

    return views;
  }

  async getByIdForUser(
    userId: string,
    seriesId: string,
  ): Promise<SeriesView | undefined> {
    const series = getSeriesById(seriesId);
    if (!series) return undefined;

    const all = await this.getAllForUser(userId);
    return all.find((s) => s.seriesId === seriesId);
  }

  async isSimulationUnlockedForUser(
    userId: string,
    simulationId: string,
  ): Promise<boolean> {
    const all = await this.getAllForUser(userId);
    for (const series of all) {
      if (!series.missions.some((m) => m.simulationId === simulationId)) {
        continue;
      }
      return series.isUnlocked;
    }
    return false;
  }
}
