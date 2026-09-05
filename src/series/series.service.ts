import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getMissionTabSeries,
  getPreviousSeries,
  getSeriesById,
  SeriesConfig,
} from './series.data';
import { isFoundationPathRewardGameId } from '../learn-path/foundation-v2-path.data';

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
    previousUnlockedNext: boolean,
    catalogIndex: number,
  ): SeriesView {
    const hasProgress = series.missionIds.some((id) => completedIds.has(id));
    const isUnlocked =
      catalogIndex === 0 || previousUnlockedNext || hasProgress;
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
      order: catalogIndex,
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
    const catalog = getMissionTabSeries();
    const views: SeriesView[] = [];

    for (let i = 0; i < catalog.length; i++) {
      const series = catalog[i];
      const prev = getPreviousSeries(series);
      // Unlock next chapter after clearing any 1 mission in the previous chapter.
      const previousUnlockedNext = prev
        ? (views.find((v) => v.seriesId === prev.seriesId)?.completedMissions ??
            0) >= 1
        : true;

      views.push(
        this.buildSeriesView(series, completedIds, previousUnlockedNext, i),
      );
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
    return all.find((s) => s.seriesId === series.seriesId);
  }

  async isSimulationUnlockedForUser(
    userId: string,
    simulationId: string,
  ): Promise<boolean> {
    // Foundation path progression is enforced by the path itself. Its dedicated
    // simulations are intentionally separate from the Adventure series catalog.
    if (isFoundationPathRewardGameId(simulationId)) {
      return true;
    }
    const all = await this.getAllForUser(userId);
    for (const view of all) {
      if (!view.missions.some((m) => m.simulationId === simulationId)) {
        continue;
      }
      return view.isUnlocked;
    }
    return false;
  }
}
