export interface GptReply {
  textEn: string;
  textTh: string;
}

/** Structured Free Talk turn (client still only needs textEn/textTh). */
export interface FreeTalkTurnReply extends GptReply {
  phase: string;
  nextAction: string;
  intent?: string;
  emotion?: string;
  grammarNote?: string;
  topic?: string;
  conversationDepth?: string;
  /** Internal only — not returned to the app. */
  grammarDamage?: 'none' | 'low' | 'medium' | 'high';
  naturalnessDamage?: 'none' | 'low' | 'medium' | 'high';
  issueNote?: string;
  softRecastEn?: string;
  softRecastTh?: string;
}

export type SessionType = 'intro' | 'legacy' | 'simulation' | 'training';

/** The app posts this instead of a transcript when the learner taps Continue. */
export const TAP_TO_CONTINUE_SENTINEL = '[continue]';

/** How a Continue tap is stored in history and shown to the model. */
export const TAP_TO_CONTINUE_TURN_TEXT = '(tapped Continue)';

/**
 * App posts this after finishing a local Emoji Speak batch (Stories 3.1).
 * Distinct from Continue so the model does not re-open the Intro listen turn.
 */
export const EMOJI_SPEAK_COMPLETE_SENTINEL = '[emoji-speak-complete]';

/** How an Emoji Speak completion is stored in history / shown to the model. */
export const EMOJI_SPEAK_COMPLETE_TURN_TEXT =
  '(finished Emoji Speak — start Pattern Challenge 1)';

export interface FeedbackHints {
  grammarTip?: string;
  mispronouncedWords: string[];
}

export interface TurnExchangeResponse {
  aiResponse: string;
  textTh: string;
  audioBase64?: string;
  contentType?: string;
  isTaskComplete: boolean;
  updatedCheckpoints: Record<string, boolean>;
  feedbackHints: FeedbackHints;
  currentTurn: number;
  /** False when the learner should tap Continue instead of speaking.
   * Omitted on paths that always expect speech. */
  expectsUserSpeech?: boolean;
  /**
   * Exact English the learner should say this turn (for Whisper bias).
   * Prefer a single word on vocab/repeat turns (e.g. "latte").
   */
  expectedSpeech?: string | null;
  /** Multi-speaker dialogue for Scene / Watch & Listen turns. */
  scene?: LessonScene;
  /** In-chat Emoji Speak card — app shows "ขอเฉลย" when present. */
  emojiSpeak?: EmojiSpeakPrompt | null;
  /**
   * Full Emoji Speak puzzle batch for this lesson phase.
   * App runs all items locally; only one API round-trip to deliver the set.
   */
  emojiSpeakSet?: EmojiSpeakPrompt[] | null;
  /**
   * Visual emoji (+ optional label) scaffolds for the learner's spoken answer.
   * Shown with the AI bubble; mic still required (tap is guide / STT bias only).
   */
  emojiChoice?: EmojiChoicePrompt | null;
  /**
   * Guided Speaking card — sentence stem + single emoji cue.
   * Learner completes the stem via mic (e.g. "I'm looking for the..." + 🏛️).
   */
  guidedSpeaking?: GuidedSpeakingPrompt | null;
  /**
   * Roleplay Intro card — listen-only; learner taps Continue to start roleplay.
   * NPC is shown as emoji; learner as their avatar.
   */
  roleplayIntro?: RoleplayIntroPrompt | null;
  /**
   * Active roleplay NPC chrome for staff turns (tag + bubble avatar).
   * Omit on Teacher / Celebrate turns.
   */
  roleplayNpc?: RoleplayNpcPrompt | null;
}

/** One Emoji Speak prompt embedded in a training turn. */
export interface EmojiSpeakPrompt {
  emoji: string;
  answer: string;
  /** Letter-blank hint shown on the puzzle card (e.g. "b _ _ _ k f _ _ t"). */
  hint?: string;
  /** 1-based index in this lesson's emoji set. */
  index?: number;
  /** Total emoji words in this lesson set. */
  total?: number;
}

/** One option in an Emoji Choice scaffold. */
export interface EmojiChoiceOption {
  emoji: string;
  /** Optional English label under the emoji (e.g. "Small", "pants"). */
  label?: string;
  /** English the learner may say for this option (STT soft-accept / bias). */
  speak: string;
}

/** In-chat Emoji Choice prompt — visual options while the learner speaks. */
export interface EmojiChoicePrompt {
  options: EmojiChoiceOption[];
}

/** Guided Speaking — stem + single emoji for the learner to complete aloud. */
export interface GuidedSpeakingPrompt {
  /** Sentence stem shown on the card (e.g. "I'm looking for the..."). */
  stem: string;
  /** Emoji cue for the missing word/place. */
  emoji: string;
  /** Optional English label under the emoji (e.g. "museum"). */
  label?: string;
  /** Full English the learner should say (STT soft-accept / bias). */
  speak: string;
}

/** Roleplay Intro — dual avatar card before staff/NPC dialogue. */
export interface RoleplayIntroPrompt {
  /** Thai (or L1) line under ROLEPLAY (e.g. "คุณกำลังคุยกับคนท้องถิ่น"). */
  subtitle: string;
  /** NPC emoji shown in the right circle. */
  npcEmoji: string;
  /** Label under the NPC circle (e.g. "คนท้องถิ่น"). */
  npcLabel: string;
  /** Name used on NPC bubbles after intro (e.g. "Local Guide"). */
  npcName?: string;
  /** Label under the learner circle (default "คุณ"). */
  userLabel?: string;
}

/** Active roleplay NPC identity for chat chrome. */
export interface RoleplayNpcPrompt {
  emoji: string;
  name: string;
  /** Mission-style objective shown under ROLEPLAY (e.g. "🎯 Ask for directions…"). */
  objective?: string;
}

/** One line in a lesson Scene dialogue (Watch & Listen). */
export interface LessonSceneLine {
  speaker: string;
  role: 'npc' | 'teacher';
  textEn: string;
  /** Thai translation of this dialogue line (for subtitle toggle). */
  textTh?: string;
  /** Gemini TTS voice override (e.g. Aoede, Puck). */
  voice?: string;
}

export interface LessonScene {
  title?: string;
  lines: LessonSceneLine[];
}

export interface SimulationConfigResponse {
  simulationId: string;
  title: string;
  difficulty: string;
  estimatedMinutes: number;
  bananaCost: number;
  systemInstruction: string;
  successCriteria: string[];
  maxTurns: number;
}

export interface SimulationSessionResponse {
  id: string;
  sessionType: 'simulation';
  simulationId: string;
  startedAt: string;
  currentTurn: number;
  maxTurns: number;
  checkpointStates: Record<string, boolean>;
  isComplete: boolean;
}

export interface StartSimulationResponse {
  session: SimulationSessionResponse;
  simulation: SimulationConfigResponse;
  opening: TurnExchangeResponse;
}

export interface HintOption {
  id: string;
  label: string;
  sentenceEn: string;
  pronunciation?: string;
}

export interface HintsResponse {
  hints: HintOption[];
}

export interface VocabItem {
  word: string;
  meaningTh: string;
  exampleEn: string;
}

export type TurnFeedbackStatus = 'great' | 'good' | 'needs_improvement';

/** Coaching feedback for one learner utterance (Mission History transcript). */
export interface TurnFeedback {
  status: TurnFeedbackStatus;
  headlineTh: string;
  detailTh?: string | null;
  /** Natural alternative ("ลองพูด"). Empty when status is great/good. */
  suggestionEn?: string | null;
  /** Why the alternative is better ("เหตุผล"). */
  suggestionReasonTh?: string | null;
}

export interface TurnFeedbackItem extends TurnFeedback {
  /** 0-based index among learner turns only. */
  userTurnIndex: number;
}

export interface StoredChatTurn {
  speaker: 'user' | 'ai';
  textEn: string;
  textTh?: string | null;
  /** Raw STT / spoken text before Thai Mix. Null when identical or legacy. */
  originalTextEn?: string | null;
  feedback?: TurnFeedback | null;
}

export interface GptReport {
  feedbackEn: string;
  feedbackTh: string;
  bestSentenceEn: string;
  bestSentenceNoteTh: string;
  grammarTip: string;
  grammarTipTh: string;
  vocab: VocabItem[];
  pronunciationIssues: Array<{ word: string; scorePercent: number }>;
  /** Per-learner-turn coaching; aligned by userTurnIndex. */
  turnFeedback?: TurnFeedbackItem[];
}

/** Free Talk wrap-up extras (also used to overwrite user memories). */
export interface FreeTalkSessionSummary extends GptReport {
  conversationSummaryEn: string;
  conversationSummaryTh: string;
  /** Up to 5 most important lasting facts from this session. */
  memories: string[];
}

export interface MissionResultResponse extends GptReport {
  sessionId: string;
  durationSeconds: number;
  topicId?: string;
  missionTitleTh?: string;
  overallScore?: number;
  scoreLabel?: string;
  starRating?: number;
  goldBananasEarned?: number;
  checkpointSummary?: Record<string, boolean>;
  rewards?: SessionRewardSummary;
  /** Achievements unlocked by this session (if any). */
  newAchievements?: Array<{
    achievementId: string;
    titleEn: string;
    titleTh: string;
    iconKey: string;
    category: string;
    rarity: string;
  }>;
  simulationId?: string;
  seriesId?: string;
  seriesTitleEn?: string;
  seriesTitleTh?: string;
  completedAt?: string;
  /** Text-only conversation turns (no audio). */
  turns?: StoredChatTurn[];
  conversationSummaryEn?: string;
  conversationSummaryTh?: string;
  memories?: string[];
}

export interface ActivityItemResponse {
  sessionId: string;
  simulationId: string;
  seriesId: string;
  seriesTitleEn: string;
  seriesTitleTh: string;
  titleEn: string;
  titleTh: string;
  coverImage: string;
  completedAt: string;
  overallScore: number;
  scoreLabel: string;
  starRating: number;
  xpEarned: number;
  seedsEarned: number;
  /** False when score/report were never persisted (legacy sessions). */
  hasDetails: boolean;
}

export interface ActivityListResponse {
  items: ActivityItemResponse[];
  nextCursor: string | null;
}

export interface ActivityDaysResponse {
  dates: string[];
}

export interface LearningStatsResponse {
  lessonsCompleted: number;
  sentencesSpoken: number;
  minutesPracticed: number;
  longestStreakDays: number;
}

export interface AchievementRewardResponse {
  seeds: number;
  bananas: number;
  outfitId: string | null;
  outfitNameEn: string | null;
  outfitNameTh: string | null;
  outfitIconKey: string | null;
}

export interface OutfitItemResponse {
  outfitId: string;
  slot: string;
  rarity: string;
  nameEn: string;
  nameTh: string;
  descriptionEn: string;
  descriptionTh: string;
  iconKey: string;
  sourceAchievementId: string | null;
  isOwned: boolean;
  acquiredAt: string | null;
}

export interface OutfitsResponse {
  ownedCount: number;
  totalCount: number;
  items: OutfitItemResponse[];
}

export interface AchievementClaimResponse {
  achievementId: string;
  reward: AchievementRewardResponse;
  outfit: OutfitItemResponse | null;
  balances: { bananas: number; xp: number; seeds: number };
}

export interface GptIntroReport {
  userName: string;
  levelTitle: string;
  levelEmoji: string;
  summaryTh: string;
  pronunciationScore: number;
  confidenceScore: number;
  listeningScore: number;
}

export interface SessionRewardSummary {
  xpEarned: number;
  seedsEarned: number;
  ratingLabel: string;
  streakDays: number;
  previousStreakDays: number;
  streakBonus?: { days: number; seedsEarned: number };
  balances: { bananas: number; xp: number; seeds: number };
  isDailyMission: boolean;
}

export interface IntroReportResponse extends GptIntroReport {
  sessionId: string;
}

export interface UserProfileResponse {
  anonymousId: string;
  displayName: string;
  onboardingCompleted: boolean;
  bananaBalance: number;
  xpBalance: number;
  bananaSeedBalance: number;
  streakDays: number;
  dailyUsedToday: boolean;
  timezone: string;
  unlockedAvatarIds: string[];
  lessonTeachingLanguage: 'thai' | 'english';
  /** Banana Ticket sheet copy — kept in sync with economy env/defaults. */
  bananaTicket: {
    dailyDrop: number;
    maxBalance: number;
    missionCost: number;
  };
}
