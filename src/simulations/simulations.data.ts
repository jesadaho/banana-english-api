export type SimulationDifficulty = 'easy' | 'medium' | 'hard';

export interface SimulationConfig {
  simulationId: string;
  title: string;
  missionNumber: number;
  missionTitleTh: string;
  scenarioTh: string;
  goalsTh: string[];
  difficulty: SimulationDifficulty;
  estimatedMinutes: number;
  bananaCost: number;
  systemInstruction: string;
  successCriteria: string[];
  maxTurns: number;
}

export const SIMULATIONS: SimulationConfig[] = [
  {
    simulationId: 'coffee_order_easy',
    title: 'สั่งกาแฟยามเช้า',
    missionNumber: 1,
    missionTitleTh: 'สั่งกาแฟแก้วแรกที่นิวยอร์ก',
    scenarioTh:
      'คุณเพิ่งเดินเข้าร้านกาแฟตอนเช้าในนิวยอร์ก และมีพนักงานบาริสต้าเดินเข้ามาทักทายพร้อมรับออเดอร์',
    goalsTh: [
      'สั่งกาแฟที่คุณชอบ 1 แก้ว',
      'เลือกขนาด (Size) หรือประเภทนม',
      'ทำท่าจ่ายเงินให้สำเร็จ',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Sam, a friendly barista at a busy NYC coffee shop. The user is ordering coffee. Keep your responses short (under 15 words) and ask simple questions. When the customer says they will pay by card (even if speech-to-text garbles it, e.g. "hard plates" means "card please"), immediately complete payment in that turn — never ask them to tap the screen. Close with a line like: "Card, got it! Payment completed. Here is your latte! Enjoy your day!"',
    successCriteria: [
      'user_specified_drink',
      'user_specified_size_or_milk',
      'payment_completed',
    ],
    maxTurns: 8,
  },
  {
    simulationId: 'business_meeting_easy',
    title: 'นัดหมายเวลาประชุม',
    missionNumber: 1,
    missionTitleTh: 'นัดหมายเวลาประชุม',
    scenarioTh:
      'คุณต้องโทรศัพท์ไปหาพาร์ทเนอร์ชาวต่างชาติเพื่อขอนัดหมายเวลาคุยโปรเจกต์ใหม่ โดยเป้าหมายคือต้องหาวันและเวลาที่ลงตัวตรงกันให้ได้',
    goalsTh: [
      'บอกจุดประสงค์ว่าต้องการนัดประชุมโปรเจกต์ใหม่',
      'เสนอวันและเวลาที่คุณสะดวก (เช่น Next Tuesday at 10 AM)',
      'พูดสรุปยืนยันวันและเวลาที่ตกลงกันได้อีกครั้งก่อนวางสาย',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Alex, a busy international business partner on a phone call. The user is calling to schedule a new project meeting. Keep responses short (under 15 words). Guide them to state their purpose, propose a day and time they are available, and confirm the final agreed schedule before ending the call.',
    successCriteria: [
      'stated_meeting_purpose',
      'proposed_date_time',
      'confirmed_schedule',
    ],
    maxTurns: 8,
  },
  {
    simulationId: 'hotel_checkin_easy',
    title: 'เช็กอินที่โรงแรม',
    missionNumber: 1,
    missionTitleTh: 'เช็กอินที่โรงแรม',
    scenarioTh:
      'คุณเดินทางมาถึงโรงแรมที่ลอนดอนหลังจากไฟลท์อันยาวนาน ตอนนี้คุณอยู่ที่หน้าล็อบบี้และต้องการแจ้งพนักงานเพื่อเข้าพักตามที่จองไว้',
    goalsTh: [
      'แจ้งชื่อและบอกว่ามาเช็กอินห้องพักที่จองล่วงหน้าไว้',
      'ยื่น/แจ้งเรื่องพาสปอร์ต หรือขอบัตรคีย์การ์ดห้องพัก',
      'ถามข้อมูลเพิ่มเติมเกี่ยวกับเวลาอาหารเช้า หรือรหัส Wi-Fi ของโรงแรม',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Jamie, a friendly receptionist at the Grand London Hotel. The user just arrived after a long flight and wants to check in to a pre-booked room. Keep responses short (under 15 words). Guide them to give their name, provide passport details or receive a room key card, and ask about breakfast hours or hotel Wi-Fi.',
    successCriteria: [
      'stated_name_checkin',
      'provided_passport_or_keycard',
      'asked_breakfast_or_wifi',
    ],
    maxTurns: 8,
  },
  {
    simulationId: 'movie_tickets_easy',
    title: 'ซื้อตั๋วหนังและเลือกที่นั่ง',
    missionNumber: 1,
    missionTitleTh: 'ซื้อตั๋วหนังและเลือกที่นั่ง',
    scenarioTh:
      'เย็นวันเสาร์อันสดใส คุณอยากไปดูหนังเรื่องโปรดที่โรงภาพยนตร์ คุณต้องเดินไปที่ช่องขายตั๋วเพื่อซื้อตั๋วและเลือกทำเลที่นั่งที่ดีที่สุด',
    goalsTh: [
      'บอกชื่อภาพยนตร์และรอบเวลาที่ต้องการดู',
      'ระบุจำนวนตั๋ว และเลือกโซนที่นั่ง (เช่น ตรงกลาง หรือแถวบนสุด)',
      'พูดเลือกประเภทป็อปคอร์นหรือเครื่องดื่มที่ต้องการเพิ่ม',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Riley, a cheerful cinema ticket clerk on a bright Saturday evening. The user wants to buy movie tickets. Keep responses short (under 15 words). Guide them to name the movie and showtime, choose ticket quantity and seat zone, then add popcorn or drinks.',
    successCriteria: [
      'stated_movie_showtime',
      'selected_tickets_seats',
      'chosen_snacks_drinks',
    ],
    maxTurns: 8,
  },
  {
    simulationId: 'pharmacy_easy',
    title: 'ร้านขายยากับอาการป่วย',
    missionNumber: 1,
    missionTitleTh: 'ร้านขายยากับอาการป่วย',
    scenarioTh:
      'คุณรู้สึกปวดหัวและมีไข้ระหว่างทริปต่างประเทศ จึงเดินเข้าไปในร้านขายยาเพื่ออธิบายอาการป่วยให้เภสัชกรฟังและซื้อยากลับไปทาน',
    goalsTh: [
      'ทักทายและแจ้งเภสัชกรว่ารู้สึกไม่สบาย',
      'อธิบายอาการป่วยของตัวเองให้ชัดเจน (เช่น เจ็บคอ ปวดหัว หรือมีไข้)',
      'ถามวิธีและปริมาณในการทานยาที่ถูกต้อง (เช่น ทานก่อนหรือหลังอาหาร)',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Dr. Kim, a caring pharmacist at a clean neighborhood pharmacy. The user feels unwell while traveling abroad and needs medicine. Keep responses short (under 15 words). Guide them to greet you, describe symptoms clearly, and ask about correct dosage instructions such as before or after meals.',
    successCriteria: [
      'greeted_pharmacist',
      'described_symptoms',
      'asked_dosage_instructions',
    ],
    maxTurns: 8,
  },
  {
    simulationId: 'restaurant_order_easy',
    title: 'สั่งอาหารที่ร้านอาหาร',
    missionNumber: 1,
    missionTitleTh: 'สั่งอาหารมื้อเย็นที่ร้านอาหาร',
    scenarioTh:
      'คุณมาทานอาหารเย็นที่ร้านอาหารในเมือง กำลังนั่งดูเมนูและพนักงานเดินมารับออเดอร์',
    goalsTh: [
      'ทักทายและขอดูเมนูหรือแนะนำเมนูยอดนิยม',
      'สั่งอาหารและเครื่องดื่มที่ต้องการ',
      'ถามเรื่องส่วนผสมหรือแพ้อาหารก่อนสั่ง',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Mia, a friendly restaurant server. The user is ordering dinner. Keep responses short (under 15 words). Guide them to greet you, order food and drinks, and ask about ingredients or allergies.',
    successCriteria: [
      'greeted_server',
      'ordered_food_drinks',
      'asked_ingredients_allergies',
    ],
    maxTurns: 8,
  },
  {
    simulationId: 'taxi_ride_easy',
    title: 'เรียกแท็กซี่ไปจุดหมาย',
    missionNumber: 1,
    missionTitleTh: 'เรียกแท็กซี่ไปจุดหมาย',
    scenarioTh:
      'คุณยืนรอแท็กซี่ข้างถนนในเมืองใหญ่ และต้องการไปสถานที่ที่จองไว้',
    goalsTh: [
      'บอกคนขับว่าต้องการไปที่ไหน',
      'ถามเรื่องเวลาเดินทางโดยประมาณหรือค่าโดยสาร',
      'ยืนยันจุดหมายก่อนลงจากรถ',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Carlos, a taxi driver in a busy city. The user needs a ride to their destination. Keep responses short (under 15 words). Guide them to state their destination, ask about fare or ETA, and confirm arrival.',
    successCriteria: [
      'stated_destination',
      'asked_fare_or_eta',
      'confirmed_arrival',
    ],
    maxTurns: 8,
  },
  {
    simulationId: 'airport_checkin_easy',
    title: 'เช็กอินที่สนามบิน',
    missionNumber: 1,
    missionTitleTh: 'เช็กอินที่สนามบิน',
    scenarioTh:
      'คุณมาถึงสนามบินก่อนเวลาบิน และต้องเช็กอินที่เคาน์เตอร์สายการบิน',
    goalsTh: [
      'แจ้งว่าต้องการเช็กอินและบอกหมายเลขเที่ยวบิน',
      'ส่งมอบพาสปอร์ตหรือเอกสารที่จำเป็น',
      'ถามเรื่องเกตขึ้นเครื่องหรือน้ำหนักสัมภาระ',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Nina, an airline check-in agent at the airport. The user needs to check in for their flight. Keep responses short (under 15 words). Guide them to provide flight details, hand over documents, and ask about gate or baggage.',
    successCriteria: [
      'stated_flight_checkin',
      'provided_documents',
      'asked_gate_or_baggage',
    ],
    maxTurns: 8,
  },
  {
    simulationId: 'business_phone_easy',
    title: 'โทรศัพท์ธุรกิจ',
    missionNumber: 1,
    missionTitleTh: 'โทรศัพท์ธุรกิจ',
    scenarioTh:
      'คุณต้องโทรติดต่อลูกค้าเพื่อแจ้งความคืบหน้าโปรเจกต์และนัดหมายครั้งถัดไป',
    goalsTh: [
      'แนะนำตัวและบอกจุดประสงค์ของการโทร',
      'สรุปความคืบหน้าโปรเจกต์อย่างกระชับ',
      'นัดเวลาพูดคุยหรือส่งเอกสารเพิ่มเติม',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Taylor, a business client on a phone call. The user is calling with a project update. Keep responses short (under 15 words). Guide them to introduce themselves, summarize progress, and schedule a follow-up.',
    successCriteria: [
      'introduced_purpose',
      'summarized_progress',
      'scheduled_followup',
    ],
    maxTurns: 8,
  },
  {
    simulationId: 'meet_client_easy',
    title: 'พบลูกค้าครั้งแรก',
    missionNumber: 1,
    missionTitleTh: 'พบลูกค้าครั้งแรก',
    scenarioTh:
      'คุณมาถึงออฟฟิศลูกค้าเพื่อพบปะครั้งแรกและนำเสนอตัวเอง',
    goalsTh: [
      'ทักทายและแนะนำตัวอย่างสุภาพ',
      'ถามเรื่องความต้องการหรือเป้าหมายของลูกค้า',
      'เสนอขั้นตอนถัดไปหรือนัดเวลาพูดคุยต่อ',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Jordan, a potential client meeting the user for the first time. Keep responses short (under 15 words). Guide them to introduce themselves, ask about needs, and propose next steps.',
    successCriteria: [
      'introduced_self',
      'asked_client_needs',
      'proposed_next_steps',
    ],
    maxTurns: 8,
  },
  {
    simulationId: 'doctor_visit_easy',
    title: 'พบแพทย์เมื่อป่วย',
    missionNumber: 1,
    missionTitleTh: 'พบแพทย์เมื่อป่วย',
    scenarioTh:
      'คุณรู้สึกไม่สบายและมาพบแพทย์ที่คลินิกในต่างประเทศ',
    goalsTh: [
      'อธิบายอาการที่รู้สึกอยู่',
      'ตอบคำถามของแพทย์เกี่ยวกับอาการ',
      'ถามวิธีรักษาและข้อควรระวัง',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Dr. Lee, a clinic doctor. The user feels unwell and came for a visit. Keep responses short (under 15 words). Guide them to describe symptoms, answer follow-up questions, and ask about treatment.',
    successCriteria: [
      'described_symptoms',
      'answered_followup',
      'asked_treatment_advice',
    ],
    maxTurns: 8,
  },
  {
    simulationId: 'ask_help_easy',
    title: 'ขอความช่วยเหลือฉุกเฉิน',
    missionNumber: 1,
    missionTitleTh: 'ขอความช่วยเหลือฉุกเฉิน',
    scenarioTh:
      'คุณเจอสถานการณ์ฉุกเฉินในต่างประเทศและต้องขอความช่วยเหลือจากคนรอบข้าง',
    goalsTh: [
      'บอกว่าต้องการความช่วยเหลือ',
      'อธิบายปัญหาที่เกิดขึ้นอย่างชัดเจน',
      'ถามว่าควรทำอย่างไรหรือโทรหาใคร',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Chris, a helpful local passerby. The user needs emergency help. Keep responses short (under 15 words). Guide them to ask for help, explain the problem clearly, and ask what to do next.',
    successCriteria: [
      'asked_for_help',
      'explained_problem',
      'asked_next_action',
    ],
    maxTurns: 8,
  },
];

const LEGACY_TOPIC_TO_SIMULATION: Record<string, string> = {
  coffee: 'coffee_order_easy',
};

export function getSimulation(
  simulationId: string,
): SimulationConfig | undefined {
  return SIMULATIONS.find((s) => s.simulationId === simulationId);
}

export function getAllSimulations(): SimulationConfig[] {
  return SIMULATIONS;
}

export function resolveSimulationIdFromTopic(
  topicId: string,
): string | undefined {
  return LEGACY_TOPIC_TO_SIMULATION[topicId];
}

export function initCheckpointStates(
  criteria: string[],
): Record<string, boolean> {
  return Object.fromEntries(criteria.map((key) => [key, false]));
}

export function mergeCheckpoints(
  current: Record<string, boolean>,
  updated: Record<string, boolean>,
): Record<string, boolean> {
  const merged = { ...current };
  for (const [key, value] of Object.entries(updated)) {
    if (key in merged && value) {
      merged[key] = true;
    }
  }
  return merged;
}

export function allCheckpointsComplete(
  checkpoints: Record<string, boolean>,
): boolean {
  return Object.values(checkpoints).every(Boolean);
}

/** STT-tolerant card-payment intent (e.g. "hard plates" → "card please"). */
export function detectsCardPaymentIntent(userText: string): boolean {
  const t = userText.toLowerCase().trim();
  const cardPatterns = [
    /\bcards?\b/,
    /\bcredit\b/,
    /\bdebit\b/,
    /\bpay\s*(by|with)?\s*card/,
    /\bhard\s*plates?\b/,
    /\bplates?\s*please\b/,
    /\bcutting\b/,
    /\buse\s*(my\s*)?card\b/,
    /\b(i'll|i will|gonna)\s*pay\b/,
    /\bpay\s*by\s*card\b/,
    /\btap\s*(my\s*)?card\b/,
  ];
  return cardPatterns.some((p) => p.test(t));
}

/** Force payment_completed when card intent is clear and order details are done. */
export function applyPaymentClosureIfNeeded(
  config: SimulationConfig,
  userText: string,
  checkpoints: Record<string, boolean>,
): Record<string, boolean> {
  if (!config.successCriteria.includes('payment_completed')) {
    return checkpoints;
  }
  if (checkpoints.payment_completed) {
    return checkpoints;
  }
  if (!isOrderReadyForPayment(config, checkpoints)) {
    return checkpoints;
  }
  if (!detectsCardPaymentIntent(userText)) {
    return checkpoints;
  }
  return { ...checkpoints, payment_completed: true };
}

function isOrderReadyForPayment(
  config: SimulationConfig,
  checkpoints: Record<string, boolean>,
): boolean {
  return (
    (!config.successCriteria.includes('user_specified_drink') ||
      checkpoints.user_specified_drink) &&
    (!config.successCriteria.includes('user_specified_size_or_milk') ||
      checkpoints.user_specified_size_or_milk)
  );
}

/** When the barista AI already closed payment in dialogue, sync the checkpoint. */
export function applyPaymentClosureFromAiReply(
  config: SimulationConfig,
  aiResponse: string,
  checkpoints: Record<string, boolean>,
): Record<string, boolean> {
  if (!config.successCriteria.includes('payment_completed')) {
    return checkpoints;
  }
  if (checkpoints.payment_completed) {
    return checkpoints;
  }
  if (!isOrderReadyForPayment(config, checkpoints)) {
    return checkpoints;
  }

  const t = aiResponse.toLowerCase();
  const aiConfirmedPayment =
    /payment\s+(completed|complete|done|successful)/.test(t) ||
    (/card,\s*got\s*it/.test(t) && /here\s+is\s+your/.test(t));

  if (!aiConfirmedPayment) {
    return checkpoints;
  }

  return { ...checkpoints, payment_completed: true };
}
