import type { ScriptTurnResult } from '../scripts/types';
import {
  type ChoiceLessonDef,
} from '../scripts/choice-lesson.script';
import {
  airportBoardForStep,
  airportLessonProgress,
  airportOpeningText,
  buildOpeningFromBoard,
  coffeeBoardForStep,
  coffeeLessonProgress,
  coffeeOpeningText,
  convenienceBoardForStep,
  convenienceLessonProgress,
  convenienceOpeningText,
  hotelBoardForStep,
  hotelLessonProgress,
  hotelOpeningText,
  pharmacyBoardForStep,
  pharmacyLessonProgress,
  pharmacyOpeningText,
  restaurantBoardForStep,
  restaurantLessonProgress,
  restaurantOpeningText,
  roleplayAfterTeaching,
  scoreAirportStep,
  scoreCoffeeStep,
  scoreConvenienceStep,
  scoreHotelStep,
  scorePharmacyStep,
  scoreRestaurantStep,
  scoreShoppingStep,
  scoreSmartShopperStep,
  scoreSurvivalStep,
  scoreTransportStep,
  shoppingBoardForStep,
  shoppingLessonProgress,
  shoppingOpeningText,
  smartShopperBoardForStep,
  smartShopperLessonProgress,
  smartShopperOpeningText,
  survivalBoardForStep,
  survivalLessonProgress,
  survivalOpeningText,
  transportBoardForStep,
  transportLessonProgress,
  transportOpeningText,
} from './around-town.lessons';

function afterRoleplay(lessonId: string): ScriptTurnResult | null {
  return roleplayAfterTeaching(lessonId);
}

export const AROUND_TOWN_SHOPPING: ChoiceLessonDef = {
  lessonId: 'ee_around_town_shopping',
  maxStep: 4,
  progressFn: shoppingLessonProgress,
  scoreStep: (step, text) => scoreShoppingStep(step, text),
  boardForStep: (step) => shoppingBoardForStep(step),
  afterTeachingComplete: () => afterRoleplay('ee_around_town_shopping'),
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      shoppingOpeningText(learnerFirstName),
      shoppingBoardForStep(1),
    );
  },
};

export const AROUND_TOWN_RESTAURANT: ChoiceLessonDef = {
  lessonId: 'ee_around_town_restaurant',
  maxStep: 4,
  progressFn: restaurantLessonProgress,
  scoreStep: (step, text) => scoreRestaurantStep(step, text),
  boardForStep: (step) => restaurantBoardForStep(step),
  afterTeachingComplete: () => afterRoleplay('ee_around_town_restaurant'),
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      restaurantOpeningText(learnerFirstName),
      restaurantBoardForStep(1),
    );
  },
};

export const AROUND_TOWN_COFFEE: ChoiceLessonDef = {
  lessonId: 'ee_around_town_coffee',
  maxStep: 4,
  progressFn: coffeeLessonProgress,
  scoreStep: (step, text) => scoreCoffeeStep(step, text),
  boardForStep: (step) => coffeeBoardForStep(step),
  afterTeachingComplete: () => afterRoleplay('ee_around_town_coffee'),
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      coffeeOpeningText(learnerFirstName),
      coffeeBoardForStep(1),
    );
  },
};

export const AROUND_TOWN_CONVENIENCE: ChoiceLessonDef = {
  lessonId: 'ee_around_town_convenience',
  maxStep: 4,
  progressFn: convenienceLessonProgress,
  scoreStep: (step, text) => scoreConvenienceStep(step, text),
  boardForStep: (step) => convenienceBoardForStep(step),
  afterTeachingComplete: () => afterRoleplay('ee_around_town_convenience'),
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      convenienceOpeningText(learnerFirstName),
      convenienceBoardForStep(1),
    );
  },
};

export const AROUND_TOWN_TRANSPORT: ChoiceLessonDef = {
  lessonId: 'ee_around_town_transport',
  maxStep: 4,
  progressFn: transportLessonProgress,
  scoreStep: (step, text) => scoreTransportStep(step, text),
  boardForStep: (step) => transportBoardForStep(step),
  afterTeachingComplete: () => afterRoleplay('ee_around_town_transport'),
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      transportOpeningText(learnerFirstName),
      transportBoardForStep(1),
    );
  },
};

export const AROUND_TOWN_SMART_SHOPPER: ChoiceLessonDef = {
  lessonId: 'ee_around_town_smart_shopper',
  maxStep: 7,
  progressFn: smartShopperLessonProgress,
  scoreStep: (step, text) => scoreSmartShopperStep(step, text),
  boardForStep: (step) => smartShopperBoardForStep(step),
  completionText: (name) =>
    `เยี่ยมเลยครับ! 👏 ${name.trim() || 'เพื่อน'} วันนี้คุณเปรียบเทียบของด้วย Which one is… / This one is… / I'll take… ได้แล้ว — เก่งมากครับ! 🛒🎉`,
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      smartShopperOpeningText(learnerFirstName),
      smartShopperBoardForStep(1),
    );
  },
};

export const AROUND_TOWN_HOTEL: ChoiceLessonDef = {
  lessonId: 'ee_around_town_hotel',
  maxStep: 5,
  progressFn: hotelLessonProgress,
  scoreStep: (step, text) => scoreHotelStep(step, text),
  boardForStep: (step) => hotelBoardForStep(step),
  completionText: (name) =>
    `เยี่ยมเลยครับ! 👏 ${name.trim() || 'เพื่อน'} วันนี้คุณเช็กอินโรงแรมเป็นภาษาอังกฤษได้แล้ว ทั้งจองห้อง ยื่นพาสปอร์ต และถามเรื่องอาหารเช้ากับห้อง — เก่งมากครับ! 🍌`,
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      hotelOpeningText(learnerFirstName),
      hotelBoardForStep(1),
    );
  },
};

export const AROUND_TOWN_AIRPORT: ChoiceLessonDef = {
  lessonId: 'ee_around_town_airport',
  maxStep: 4,
  progressFn: airportLessonProgress,
  scoreStep: (step, text) => scoreAirportStep(step, text),
  boardForStep: (step) => airportBoardForStep(step),
  afterTeachingComplete: () => afterRoleplay('ee_around_town_airport'),
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      airportOpeningText(learnerFirstName),
      airportBoardForStep(1),
    );
  },
};

export const AROUND_TOWN_PHARMACY: ChoiceLessonDef = {
  lessonId: 'ee_around_town_pharmacy',
  maxStep: 4,
  progressFn: pharmacyLessonProgress,
  scoreStep: (step, text) => scorePharmacyStep(step, text),
  boardForStep: (step) => pharmacyBoardForStep(step),
  afterTeachingComplete: () => afterRoleplay('ee_around_town_pharmacy'),
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      pharmacyOpeningText(learnerFirstName),
      pharmacyBoardForStep(1),
    );
  },
};

export const AROUND_TOWN_SURVIVAL: ChoiceLessonDef = {
  lessonId: 'ee_around_town_survival',
  maxStep: 3,
  progressFn: survivalLessonProgress,
  scoreStep: (step, text) => scoreSurvivalStep(step, text),
  boardForStep: (step) => survivalBoardForStep(step),
  completionText: (name) =>
    `เยี่ยมเลยครับ! 👏 ${name.trim() || 'เพื่อน'} วันนี้คุณใช้ประโยคเอาตัวรอด I can't find my… / Can you help me? / Can you speak slowly? ได้แล้ว — เก่งมากครับ! 🍌`,
  clampNearIncorrectToCorrect: true,
  buildOpening(learnerFirstName: string): ScriptTurnResult {
    return buildOpeningFromBoard(
      survivalOpeningText(learnerFirstName),
      survivalBoardForStep(1),
    );
  },
};

export const AROUND_TOWN_CHOICE_LESSONS: ChoiceLessonDef[] = [
  AROUND_TOWN_SHOPPING,
  AROUND_TOWN_RESTAURANT,
  AROUND_TOWN_COFFEE,
  AROUND_TOWN_CONVENIENCE,
  AROUND_TOWN_TRANSPORT,
  AROUND_TOWN_SMART_SHOPPER,
  AROUND_TOWN_HOTEL,
  AROUND_TOWN_AIRPORT,
  AROUND_TOWN_PHARMACY,
  AROUND_TOWN_SURVIVAL,
];

const BY_ID = new Map(
  AROUND_TOWN_CHOICE_LESSONS.map((d) => [d.lessonId, d]),
);

export function getAroundTownChoiceLesson(
  lessonId: string,
): ChoiceLessonDef | undefined {
  return BY_ID.get(lessonId);
}

export function isAroundTownChoiceLesson(lessonId: string): boolean {
  return BY_ID.has(lessonId);
}
