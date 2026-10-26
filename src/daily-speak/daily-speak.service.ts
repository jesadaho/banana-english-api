import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { audioUrlForTurn } from '../tts/tts-bank';
import {
  dailySpeakDayOfChallenge,
  sentenceForCompletionCount,
  type DailySpeakSentence,
} from './daily-speak.data';
import { DAILY_SPEAK_TEACHER_LINES } from './daily-speak-feedback.service';

@Injectable()
export class DailySpeakService {
  todayForUser(user: User): {
    sentence: DailySpeakSentence;
    dayNumber: number;
    dailySpeakCount: number;
    coachAudio: {
      great: string | null;
      almost: string | null;
      rough: string | null;
    };
  } {
    const dailySpeakCount =
      (user as User & { dailySpeakCount?: number }).dailySpeakCount ?? 0;
    const sentence = sentenceForCompletionCount(dailySpeakCount);
    return {
      sentence,
      dayNumber: dailySpeakDayOfChallenge(dailySpeakCount),
      dailySpeakCount,
      coachAudio: {
        great: audioUrlForTurn(DAILY_SPEAK_TEACHER_LINES.great),
        almost: audioUrlForTurn(DAILY_SPEAK_TEACHER_LINES.almost),
        rough: audioUrlForTurn(DAILY_SPEAK_TEACHER_LINES.rough),
      },
    };
  }
}
