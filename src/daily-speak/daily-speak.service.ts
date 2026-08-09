import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import {
  dailySpeakDayOfChallenge,
  sentenceForCompletionCount,
  type DailySpeakSentence,
} from './daily-speak.data';

@Injectable()
export class DailySpeakService {
  todayForUser(user: User): {
    sentence: DailySpeakSentence;
    dayNumber: number;
    dailySpeakCount: number;
  } {
    const dailySpeakCount =
      (user as User & { dailySpeakCount?: number }).dailySpeakCount ?? 0;
    const sentence = sentenceForCompletionCount(dailySpeakCount);
    return {
      sentence,
      dayNumber: dailySpeakDayOfChallenge(dailySpeakCount),
      dailySpeakCount,
    };
  }
}
