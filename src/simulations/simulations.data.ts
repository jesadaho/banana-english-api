export type SimulationDifficulty = 'easy' | 'medium' | 'hard';

export interface VocabDrillWord {
  word: string;
  pronunciation: string;
  meaningTh: string;
}

export interface SimulationConfig {
  simulationId: string;
  title: string;
  missionNumber: number;
  missionTitleTh: string;
  scenarioTh: string;
  goalsTh: string[];
  goalsEn: string[];
  difficulty: SimulationDifficulty;
  estimatedMinutes: number;
  bananaCost: number;
  systemInstruction: string;
  /** Optional user prompt override for the first AI turn. */
  openingPrompt?: string;
  successCriteria: string[];
  maxTurns: number;
  vocabDrill: VocabDrillWord[];
}

const AI_LEAD =
  'You lead this easy conversation. Ask short clarifying questions and gently guide the learner through each objective. Keep every reply under 15 words. Never dump all questions at once.';

export const SIMULATIONS: SimulationConfig[] = [
  {
    simulationId: 'coffee_order_easy',
    title: 'สั่งกาแฟยามเช้า',
    missionNumber: 1,
    missionTitleTh: 'สั่งกาแฟแก้วแรกที่นิวยอร์ก',
    scenarioTh:
      'คุณเพิ่งเดินเข้าร้านกาแฟตอนเช้าในนิวยอร์ก และมีพนักงานบาริสต้าเดินเข้ามาทักทายพร้อมรับออเดอร์',
    goalsTh: [
      'สั่งเครื่องดื่ม',
      'ถามราคา',
      'ชำระเงิน / ขอบคุณ',
    ],
    goalsEn: [
      'Order a drink',
      'Ask the price',
      'Pay / say thank you',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Sam, a friendly barista at a busy NYC coffee shop. Flow: greet and ask what they want → after they order, say "Sure! Anything else?" (give space for them to ask the price) → when they ask "How much is it?" (or close), tell a simple price → then take payment / thanks and hand over the drink. Soft-accept "How much?" / "How much is this?". When they pay by card (even if STT garbles it, e.g. "hard plates" = "card please"), complete payment in that turn — never ask them to tap the screen. Close like: "Card, got it! Payment completed. Here is your latte! Enjoy your day!" Do NOT require size/milk as a separate objective.`,
    successCriteria: [
      'ordered_drink',
      'asked_price',
      'payment_completed',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Latte', pronunciation: 'ลา-เท', meaningTh: 'กาแฟลาเต้' },
      { word: 'Espresso', pronunciation: 'เอส-เพรส-โซ', meaningTh: 'กาแฟเอสเพรสโซ' },
      { word: 'How much is it?', pronunciation: 'ฮาว-มัช-อิส-อิท', meaningTh: 'ราคาเท่าไหร่?' },
      { word: 'Receipt', pronunciation: 'ริ-ซีท', meaningTh: 'ใบเสร็จ' },
      { word: 'Thank you', pronunciation: 'แทงก์-ยู', meaningTh: 'ขอบคุณ' },
    ],
  },
  {
    simulationId: 'restaurant_order_easy',
    title: 'สั่งอาหารที่ร้านอาหาร',
    missionNumber: 2,
    missionTitleTh: 'สั่งอาหารมื้อเย็นที่ร้านอาหาร',
    scenarioTh:
      'คุณมาทานอาหารเย็นที่ร้านอาหารในเมือง กำลังนั่งดูเมนูและพนักงานเดินมารับออเดอร์',
    goalsTh: [
      'สั่งอาหาร',
      'ขอคำแนะนำ',
      'สั่งเครื่องดื่มหรือขอใบเสร็จ',
    ],
    goalsEn: [
      'Order a meal',
      'Ask for a recommendation',
      'Order a drink or ask for the bill',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Mia, a friendly restaurant server. Guide them to: (1) order a meal, (2) ask "What do you recommend?" (or close) — then give a short recommendation, (3) order a drink OR ask for the bill/receipt. Soft-accept "Any recommendations?" / "What do you recommend?". Lead with short questions like "Are you ready to order?" — leave room for THEM to ask for a recommendation; do not dump the answer first.`,
    successCriteria: [
      'ordered_meal',
      'asked_recommendation',
      'ordered_drink_or_bill',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Appetizer', pronunciation: 'แอพ-พิ-ไท-เซอร์', meaningTh: 'อาหารเรียกน้ำย่อย' },
      { word: 'What do you recommend?', pronunciation: 'ว็อท-ดู-ยู-เรค-คะ-เมนด์', meaningTh: 'แนะนำอะไรดี?' },
      { word: 'Beverage', pronunciation: 'เบฟ-เวอ-ริจ', meaningTh: 'เครื่องดื่ม' },
      { word: 'Bill', pronunciation: 'บิล', meaningTh: 'บิล / ใบเสร็จค่าอาหาร' },
      { word: 'Allergic', pronunciation: 'อะ-เลอร์-จิก', meaningTh: 'แพ้ (อาหาร)' },
    ],
  },
  {
    simulationId: 'movie_tickets_easy',
    title: 'ซื้อตั๋วหนังและเลือกที่นั่ง',
    missionNumber: 3,
    missionTitleTh: 'ซื้อตั๋วหนังและเลือกที่นั่ง',
    scenarioTh:
      'เย็นวันเสาร์อันสดใส คุณอยากไปดูหนังเรื่องโปรดที่โรงภาพยนตร์ คุณต้องเดินไปที่ช่องขายตั๋วเพื่อซื้อตั๋วและเลือกทำเลที่นั่งที่ดีที่สุด',
    goalsTh: [
      'เลือกหนังและรอบฉาย',
      'เลือกที่นั่ง',
      'เพิ่มขนมหรือเครื่องดื่ม',
    ],
    goalsEn: [
      'Choose a movie and showtime',
      'Select your seats',
      'Add snacks or drinks',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Riley, a cheerful cinema ticket clerk. Ask which movie and showtime they want, help them pick seats, then offer snacks or drinks.`,
    successCriteria: [
      'stated_movie_showtime',
      'selected_tickets_seats',
      'chosen_snacks_drinks',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Showtime', pronunciation: 'โชว์-ไทม์', meaningTh: 'รอบฉาย' },
      { word: 'Subtitles', pronunciation: 'ซับ-ไท-เทิลส์', meaningTh: 'คำบรรยาย' },
      { word: 'Seat', pronunciation: 'ซีท', meaningTh: 'ที่นั่ง' },
      { word: 'Popcorn', pronunciation: 'พ็อป-คอร์น', meaningTh: 'ป็อปคอร์น' },
      { word: 'Screen', pronunciation: 'สกรีน', meaningTh: 'จอภาพยนตร์' },
    ],
  },
  {
    simulationId: 'hotel_checkin_easy',
    title: 'เช็กอินที่โรงแรม',
    missionNumber: 1,
    missionTitleTh: 'เช็กอินที่โรงแรม',
    scenarioTh:
      'คุณเดินทางมาถึงโรงแรมที่ลอนดอนหลังจากไฟลท์อันยาวนาน ตอนนี้คุณอยู่ที่หน้าล็อบบี้และต้องการแจ้งพนักงานเพื่อเข้าพักตามที่จองไว้',
    goalsTh: [
      'เช็กอิน',
      'ยืนยันการจอง',
      'รับกุญแจห้อง',
    ],
    goalsEn: [
      'Check in',
      'Confirm your booking',
      'Receive your room key',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Jamie, a friendly receptionist at the Grand London Hotel. Guide check-in and booking confirmation, then hand over the room key. You may ask about passport, Wi-Fi, or breakfast yourself — do not require the learner to bring those up first.`,
    successCriteria: [
      'checked_in',
      'confirmed_booking',
      'received_room_key',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Reservation', pronunciation: 'เร-เซอร์-เว-ชั่น', meaningTh: 'การจองห้องพัก' },
      { word: 'Check-in', pronunciation: 'เช็ค-อิน', meaningTh: 'เช็กอิน' },
      { word: 'Lobby', pronunciation: 'ล็อบ-บี้', meaningTh: 'ล็อบบี้โรงแรม' },
      { word: 'Passport', pronunciation: 'พาส-พอร์ท', meaningTh: 'หนังสือเดินทาง' },
      { word: 'Key card', pronunciation: 'คีย์-การ์ด', meaningTh: 'คีย์การ์ด / กุญแจห้อง' },
    ],
  },
  {
    simulationId: 'taxi_ride_easy',
    title: 'เรียกแท็กซี่ไปจุดหมาย',
    missionNumber: 2,
    missionTitleTh: 'เรียกแท็กซี่ไปจุดหมาย',
    scenarioTh:
      'คุณยืนรอแท็กซี่ข้างถนนในเมืองใหญ่ และต้องการไปสถานที่ที่จองไว้',
    goalsTh: [
      'บอกจุดหมาย',
      'ถามใช้เวลานานแค่ไหน (How long does it take?)',
      'ยืนยันออกเดินทาง',
    ],
    goalsEn: [
      'Say your destination',
      'Ask how long it takes (How long does it take?)',
      'Confirm you are ready to go',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Carlos, a taxi driver. Guide them to: (1) state a destination, (2) ask "How long does it take?" (or close) — then answer briefly with a short time, (3) confirm departure (e.g. "Okay, let's go" / "Yes, please"). Soft-accept "How long?" / "How long does it take?". Do NOT require them to ask the price. Lead with "Where are you going?" — leave room for THEM to ask about time.`,
    successCriteria: [
      'stated_destination',
      'asked_duration',
      'confirmed_departure',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Destination', pronunciation: 'เดส-ทิ-เน-ชั่น', meaningTh: 'จุดหมายปลายทาง' },
      { word: 'How long does it take?', pronunciation: 'ฮาว-ลอง-ดัส-อิท-เทค', meaningTh: 'ใช้เวลานานไหม?' },
      { word: 'Traffic', pronunciation: 'แทรฟ-ฟิก', meaningTh: 'รถติด / การจราจร' },
      { word: 'Fare', pronunciation: 'แฟร์', meaningTh: 'ค่าโดยสาร' },
      { word: 'Drop off', pronunciation: 'ดร็อป-ออฟ', meaningTh: 'จุดส่ง / ลงรถ' },
    ],
  },
  {
    simulationId: 'airport_checkin_easy',
    title: 'เช็กอินที่สนามบิน',
    missionNumber: 3,
    missionTitleTh: 'เช็กอินที่สนามบิน',
    scenarioTh:
      'คุณมาถึงสนามบินก่อนเวลาบิน และต้องเช็กอินที่เคาน์เตอร์สายการบิน',
    goalsTh: [
      'เช็กอินเที่ยวบิน',
      'ยืนยันเอกสารการเดินทาง',
      'รับบอร์ดดิ้งพาส',
    ],
    goalsEn: [
      'Check in for your flight',
      'Confirm your travel documents',
      'Receive your boarding pass',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Nina, an airline check-in agent. Guide flight check-in, travel documents, then give the boarding pass. You may ask about baggage, gate, or seat yourself — do not require the learner to raise those topics first.`,
    successCriteria: [
      'checked_in_flight',
      'confirmed_documents',
      'received_boarding_pass',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Boarding pass', pronunciation: 'บอร์-ดิ้ง-พาส', meaningTh: 'บัตรขึ้นเครื่อง' },
      { word: 'Luggage', pronunciation: 'ลัก-กิจ', meaningTh: 'กระเป๋าเดินทาง' },
      { word: 'Gate', pronunciation: 'เกท', meaningTh: 'ประตูขึ้นเครื่อง' },
      { word: 'Departure', pronunciation: 'ดิ-พาร์-เชอร์', meaningTh: 'ขาออก' },
      { word: 'Window seat', pronunciation: 'วิน-โดว์-ซีท', meaningTh: 'ที่นั่งริมหน้าต่าง' },
    ],
  },
  {
    simulationId: 'meet_client_easy',
    title: 'พบลูกค้าครั้งแรก',
    missionNumber: 1,
    missionTitleTh: 'พบลูกค้าครั้งแรก',
    scenarioTh:
      'คุณมาถึงออฟฟิศลูกค้าเพื่อพบปะครั้งแรกและนำเสนอตัวเอง',
    goalsTh: [
      'แนะนำตัวเอง',
      'ตอบสนองความต้องการของลูกค้า',
      'ตกลงขั้นตอนถัดไป',
    ],
    goalsEn: [
      'Introduce yourself',
      "Respond to the client's needs",
      'Agree on the next step',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Jordan, a potential client meeting the learner for the first time. The client should introduce themselves and explain what they need before asking the learner any questions. Warmly invite the learner's introduction, listen for how they respond to your needs, then guide them to agree on a clear next step.`,
    openingPrompt:
      'Start the simulation. Open as Jordan (the client). In one short reply, introduce yourself with your name and company, explain that your company is looking for an English training solution for the sales team, and end warmly with "Nice to meet you." Follow this closely: "Hi, I\'m Jordan from Northline Company. We\'re looking for an English training solution for our sales team. Nice to meet you." Do not ask the learner any questions on this first turn.',
    successCriteria: [
      'introduced_self',
      'responded_to_client_needs',
      'proposed_next_steps',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Pleasure', pronunciation: 'เพลช-เชอร์', meaningTh: 'ความยินดี' },
      { word: 'Proposal', pronunciation: 'โพร-โพ-ซัล', meaningTh: 'ข้อเสนอ' },
      { word: 'Budget', pronunciation: 'บัด-เจ็ท', meaningTh: 'งบประมาณ' },
      { word: 'Timeline', pronunciation: 'ไทม์-ไลน์', meaningTh: 'ไทม์ไลน์ / กำหนดการ' },
      { word: 'Follow up', pronunciation: 'ฟอล-โลว์-อัพ', meaningTh: 'ติดตามผล' },
    ],
  },
  {
    simulationId: 'business_meeting_easy',
    title: 'นัดหมายเวลาประชุม',
    missionNumber: 2,
    missionTitleTh: 'นัดหมายเวลาประชุม',
    scenarioTh:
      'คุณต้องโทรศัพท์ไปหาพาร์ทเนอร์ชาวต่างชาติเพื่อขอนัดหมายเวลาคุยโปรเจกต์ใหม่ โดยเป้าหมายคือต้องหาวันและเวลาที่ลงตัวตรงกันให้ได้',
    goalsTh: [
      'เสนอเวลานัดหมาย',
      'ตกลงตารางเวลา',
      'ยืนยันการนัดหมาย',
    ],
    goalsEn: [
      'Suggest a meeting time',
      'Agree on a schedule',
      'Confirm the meeting',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Alex, a busy international business partner on a call. Prompt them to suggest a meeting time, negotiate until you both agree, then confirm the final schedule before ending.`,
    successCriteria: [
      'suggested_meeting_time',
      'agreed_schedule',
      'confirmed_meeting',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Schedule', pronunciation: 'สเก็ด-จูล', meaningTh: 'ตารางเวลา' },
      { word: 'Available', pronunciation: 'อะ-เว-ละ-เบิ้ล', meaningTh: 'ว่าง / สะดวก' },
      { word: 'Reschedule', pronunciation: 'รี-สเก็ด-จูล', meaningTh: 'เลื่อนนัด' },
      { word: 'Confirm', pronunciation: 'คอน-เฟิร์ม', meaningTh: 'ยืนยัน' },
      { word: 'Agenda', pronunciation: 'อะ-เจน-ด้า', meaningTh: 'วาระการประชุม' },
    ],
  },
  {
    simulationId: 'business_phone_easy',
    title: 'โทรศัพท์ธุรกิจ',
    missionNumber: 3,
    missionTitleTh: 'โทรศัพท์ธุรกิจ',
    scenarioTh:
      'คุณต้องโทรติดต่อลูกค้าเพื่อแจ้งความคืบหน้าโปรเจกต์และนัดหมายครั้งถัดไป',
    goalsTh: [
      'แนะนำตัวเอง',
      'อัปเดตความคืบหน้าโปรเจกต์',
      'นัดหมายครั้งถัดไป',
    ],
    goalsEn: [
      'Introduce yourself',
      'Give a project update',
      'Arrange a follow-up',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Taylor, a business client on a phone call. Ask them to introduce themselves, invite a short project update, then help arrange a follow-up. Keep the call structured and easy.`,
    successCriteria: [
      'introduced_purpose',
      'summarized_progress',
      'scheduled_followup',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Update', pronunciation: 'อัพ-เดท', meaningTh: 'อัปเดต / แจ้งความคืบหน้า' },
      { word: 'Deadline', pronunciation: 'เด็ด-ไลน์', meaningTh: 'กำหนดส่ง' },
      { word: 'Progress', pronunciation: 'โพร-เกรส', meaningTh: 'ความคืบหน้า' },
      { word: 'Deliverable', pronunciation: 'ดิ-ลิ-เวอ-ระ-เบิ้ล', meaningTh: 'สิ่งที่ต้องส่งมอบ' },
      { word: 'Stakeholder', pronunciation: 'สเตก-โฮล-เดอร์', meaningTh: 'ผู้มีส่วนได้ส่วนเสีย' },
    ],
  },
  {
    simulationId: 'pharmacy_easy',
    title: 'ร้านขายยากับอาการป่วย',
    missionNumber: 1,
    missionTitleTh: 'ร้านขายยากับอาการป่วย',
    scenarioTh:
      'คุณรู้สึกปวดหัวและมีไข้ระหว่างทริปต่างประเทศ จึงเดินเข้าไปในร้านขายยาเพื่ออธิบายอาการป่วยให้เภสัชกรฟังและซื้อยากลับไปทาน',
    goalsTh: [
      'อธิบายอาการ',
      'ซื้อยาที่เหมาะสม',
      'เข้าใจวิธีรับประทาน',
    ],
    goalsEn: [
      'Describe your symptoms',
      'Get the right medicine',
      'Understand how to take it',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Dr. Kim, a caring pharmacist. Ask what is wrong, recommend simple medicine, then explain how to take it (e.g. before or after meals).`,
    successCriteria: [
      'described_symptoms',
      'got_medicine',
      'understood_dosage',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Headache', pronunciation: 'เฮด-เอค', meaningTh: 'ปวดหัว' },
      { word: 'Fever', pronunciation: 'ฟี-เวอร์', meaningTh: 'มีไข้' },
      { word: 'Prescription', pronunciation: 'พรี-สคริป-ชั่น', meaningTh: 'ใบสั่งยา' },
      { word: 'Dosage', pronunciation: 'โด-เสจ', meaningTh: 'ขนาดยา / ปริมาณยา' },
      { word: 'Symptom', pronunciation: 'ซิมพ์-ทัม', meaningTh: 'อาการ' },
    ],
  },
  {
    simulationId: 'doctor_visit_easy',
    title: 'พบแพทย์เมื่อป่วย',
    missionNumber: 2,
    missionTitleTh: 'พบแพทย์เมื่อป่วย',
    scenarioTh:
      'คุณรู้สึกไม่สบายและมาพบแพทย์ที่คลินิกในต่างประเทศ',
    goalsTh: [
      'อธิบายอาการ',
      'ตอบคำถามของหมอ',
      'เข้าใจการรักษา',
    ],
    goalsEn: [
      'Describe your symptoms',
      "Answer the doctor's questions",
      'Understand the treatment',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Dr. Lee at a clinic. Ask about symptoms, follow up with easy questions, then clearly explain the treatment.`,
    successCriteria: [
      'described_symptoms',
      'answered_followup',
      'asked_treatment_advice',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Appointment', pronunciation: 'อะ-พ้อยท์-เม้นท์', meaningTh: 'การนัดพบแพทย์' },
      { word: 'Diagnosis', pronunciation: 'ได-แอ็ก-โน-ซิส', meaningTh: 'การวินิจฉัย' },
      { word: 'Medicine', pronunciation: 'เมด-ดิ-ซิน', meaningTh: 'ยา' },
      { word: 'Sore throat', pronunciation: 'ซอร์-โธรท', meaningTh: 'เจ็บคอ' },
      { word: 'Treatment', pronunciation: 'ทรีท-เม้นท์', meaningTh: 'การรักษา' },
    ],
  },
  {
    simulationId: 'ask_help_easy',
    title: 'ขอความช่วยเหลือฉุกเฉิน',
    missionNumber: 3,
    missionTitleTh: 'ขอความช่วยเหลือฉุกเฉิน',
    scenarioTh:
      'คุณเจอสถานการณ์ฉุกเฉินในต่างประเทศและต้องขอความช่วยเหลือจากคนรอบข้าง',
    goalsTh: [
      'อธิบายสถานการณ์',
      'บอกรายละเอียดที่สำคัญ',
      'ได้รับความช่วยเหลือที่ต้องการ',
    ],
    goalsEn: [
      'Explain your situation',
      'Share the important details',
      'Get the help you need',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Chris, a helpful local passerby. Calmly ask what happened, prompt for important details, then offer clear next steps so they get the help they need.`,
    successCriteria: [
      'explained_situation',
      'shared_details',
      'got_help',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Emergency', pronunciation: 'อิ-เมอร์-เจน-ซี่', meaningTh: 'เหตุฉุกเฉิน' },
      { word: 'Ambulance', pronunciation: 'แอม-บิว-แลนซ์', meaningTh: 'รถพยาบาล' },
      { word: 'Police', pronunciation: 'โพ-ลีส', meaningTh: 'ตำรวจ' },
      { word: 'Stolen', pronunciation: 'สโต-เลน', meaningTh: 'ถูกขโมย' },
      { word: 'Embassy', pronunciation: 'เอ็ม-บะ-ซี่', meaningTh: 'สถานทูต' },
    ],
  },
  {
    simulationId: 'meet_new_friend_easy',
    title: 'ทำความรู้จักเพื่อนใหม่',
    missionNumber: 1,
    missionTitleTh: 'ทำความรู้จักเพื่อนใหม่',
    scenarioTh:
      'คุณกำลังเดินเล่นในสวนสาธารณะ มีเพื่อนชายคนหนึ่งยิ้มแล้วทักทายคุณ นี่เป็นโอกาสดีในการทำความรู้จักเพื่อนใหม่ และฝึกบทสนทนาภาษาอังกฤษครั้งแรก',
    goalsTh: [
      'แนะนำตัวเอง',
      'ตอบคำถามง่ายๆ เกี่ยวกับตัวเอง',
      'ทำความรู้จักเพื่อนใหม่',
    ],
    goalsEn: [
      'Introduce yourself',
      'Answer simple questions about yourself',
      'Get to know your new friend',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Max, a friendly young man the learner meets while walking in the park. You just smiled and said hello. Warmly help them introduce themselves, ask simple questions about them (name, where they are from, what they do / work or school, what they like), and share a little about yourself so they get to know you. Keep it light and social — not a job interview. Speak as a male (use "ครับ" tone in any Thai). Celebrate when they share about themselves.

Follow this arc after the opening greeting (one question per turn — never dump multiple questions):
1) Learner greets → ask their name (or react to it warmly).
2) Ask where they are from.
3) Ask what they do (work or study).
4) Ask what they like / a hobby.
5) Share one short thing about yourself (Max's job, hobby, or where you're from).
6) Warm close only: "Nice talking to you!" — mark ALL checkpoints true. Do NOT ask another question.

Closure rules (critical):
- When 2 or fewer turns remain, you MUST close warmly and set every checkpoint to true.
- Never loop on the same topic or re-ask name / hobby once already answered.
- Accept STT quirks (e.g. "OV" may mean hobby/game) — acknowledge and move forward.`,
    openingPrompt:
      'Start the simulation. Open as Max, a friendly guy in the park. In one short reply, smile and greet them, say your name is Max, and end with "Nice to meet you." Follow this closely: "Hi! I\'m Max. Nice to meet you." Do not ask the learner any questions on this first turn.',
    successCriteria: [
      'introduced_self',
      'answered_about_self',
      'got_to_know_friend',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Nice to meet you', pronunciation: 'ไนซ์-ทู-มีท-ยู', meaningTh: 'ยินดีที่ได้รู้จัก' },
      { word: 'Friend', pronunciation: 'เฟรนด์', meaningTh: 'เพื่อน' },
      { word: 'Park', pronunciation: 'พาร์ค', meaningTh: 'สวนสาธารณะ' },
      { word: 'Where are you from?', pronunciation: 'แวร์-อาร์-ยู-ฟรอม', meaningTh: 'คุณมาจากไหน?' },
      { word: 'What do you do?', pronunciation: 'ว็อท-ดู-ยู-ดู', meaningTh: 'คุณทำอาชีพอะไร / เรียนอะไร?' },
      { word: 'Hobby', pronunciation: 'ฮ็อบ-บี้', meaningTh: 'งานอดิเรก' },
    ],
  },
  {
    simulationId: 'join_english_club_easy',
    title: 'เข้าร่วมคลับภาษาอังกฤษ',
    missionNumber: 3,
    missionTitleTh: 'เข้าร่วมคลับภาษาอังกฤษ',
    scenarioTh:
      'คุณไปงานปฐมนิเทศของคลับภาษาอังกฤษ และต้องแนะนำตัวกับสมาชิกคนอื่นๆ',
    goalsTh: [
      'แนะนำตัวเองให้คลับ',
      'พูดเกี่ยวกับตัวเอง',
      'ถามคำถามเกี่ยวกับคลับ',
    ],
    goalsEn: [
      'Introduce yourself to the club',
      'Talk about yourself.',
      'Ask a question about the club',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Leo, a friendly English club member welcoming a new joiner. Help them introduce themselves, then invite them to talk about themselves (e.g. hobbies, work/study, where they are from — not "why do you want to join"). After they share, briefly share something about yourself too so they have something natural to follow up on — not only answer your questions. Then invite one question about the club and welcome them warmly.`,
    openingPrompt:
      'Start the simulation. Open as Leo from the English club. Greet them briefly and welcome them to the club orientation. Follow this closely: "Hi! Welcome to our English club. I\'m Leo." Do not ask the learner any questions on this first turn.',
    successCriteria: [
      'introduced_self',
      'talked_about_self',
      'asked_about_club',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Club', pronunciation: 'คลับ', meaningTh: 'ชมรม / คลับ' },
      { word: 'Member', pronunciation: 'เมม-เบอร์', meaningTh: 'สมาชิก' },
      { word: 'Join', pronunciation: 'จอยน์', meaningTh: 'เข้าร่วม' },
      { word: 'Practice', pronunciation: 'แพรก-ทิส', meaningTh: 'ฝึกฝน' },
      { word: 'Welcome', pronunciation: 'เวล-คัม', meaningTh: 'ยินดีต้อนรับ' },
      { word: 'Improve', pronunciation: 'อิม-พรูฟ', meaningTh: 'พัฒนา / ทำให้ดีขึ้น' },
    ],
  },
  {
    simulationId: 'small_talk_easy',
    title: 'คุยเรื่องตัวเอง',
    missionNumber: 2,
    missionTitleTh: 'คุยเรื่องตัวเอง',
    scenarioTh:
      'คุณเจอ Emma และคุยภาษาอังกฤษเรื่องตัวเอง ชีวิตประจำวัน บ้าน และงานหรือโรงเรียน',
    goalsTh: [
      'แนะนำตัว',
      'เล่าเรื่องชีวิตประจำวัน',
      'เล่าเรื่องบ้าน',
      'เล่าเรื่องงานหรือโรงเรียน',
    ],
    goalsEn: [
      'Introduce yourself',
      'Talk about your daily life',
      'Talk about your home',
      'Talk about work or school',
    ],
    difficulty: 'easy',
    estimatedMinutes: 8,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Emma, a friendly person helping the learner talk about themselves. Follow this arc closely (adapt wording slightly, but keep the same topics and order):
1) Open with a short greeting + your name only (e.g. "Hi! I'm Emma.") — no question yet.
2) After they greet/introduce themselves, ask these 5 questions in order — MANDATORY, one question per turn, wait for their answer before the next:
   Q1) "What time do you wake up?"
   Q2) "What do you usually have for breakfast?"
   Q3) "Where do you live?"
   Q4) "Where do you work or study?"
   Q5) "Do you enjoy your work or school?"
3) After Q5 is answered, close warmly (e.g. "Nice talking to you!").
Keep turns short and beginner-friendly. Accept natural variants. Do NOT skip, reorder, or replace these 5 questions. Do NOT ask about weather, pets, or weekend plans.`,
    openingPrompt:
      'Start the simulation. Open as Emma. Greet them briefly and introduce yourself only. Follow this closely: "Hi! I\'m Emma." Do not ask the learner any questions on this first turn.',
    successCriteria: [
      'introduced_self',
      'talked_about_daily_life',
      'talked_about_home',
      'talked_about_work_or_school',
    ],
    maxTurns: 14,
    vocabDrill: [
      { word: 'Wake up', pronunciation: 'เวค-อัพ', meaningTh: 'ตื่นนอน' },
      { word: 'Breakfast', pronunciation: 'เบรค-ฟาสต์', meaningTh: 'อาหารเช้า' },
      { word: 'Live', pronunciation: 'ลิฟ', meaningTh: 'อาศัยอยู่' },
      { word: 'Work', pronunciation: 'เวิร์ค', meaningTh: 'ทำงาน' },
      { word: 'Study', pronunciation: 'สตัด-ดี้', meaningTh: 'เรียน' },
      { word: 'Enjoy', pronunciation: 'เอ็น-จอย', meaningTh: 'สนุก / ชอบ' },
    ],
  },
  {
    simulationId: 'talk_about_trip_easy',
    title: 'เล่าเรื่องทริป',
    missionNumber: 4,
    missionTitleTh: 'เล่าเรื่องทริปของคุณ',
    scenarioTh:
      'คุณเพิ่งกลับจากทริป เพื่อนอยากรู้ว่าคุณไปไหนมา ทำอะไรบ้าง และทริปเป็นอย่างไร นี่เป็นโอกาสให้คุณเล่าเรื่องทริปและฝึกพูดภาษาอังกฤษกับเพื่อน',
    goalsTh: [
      'บอกว่าไปที่ไหน',
      'เล่าว่าทำอะไร',
      'บอกความรู้สึกเกี่ยวกับทริป',
      'ตอบคำถามเพื่อนให้จบการสนทนา',
    ],
    goalsEn: [
      'Say where you went',
      'Talk about what you did',
      'Share how you felt about the trip',
      "Answer your friend's questions to wrap up",
    ],
    difficulty: 'easy',
    estimatedMinutes: 8,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Jamie, a friendly friend excited to hear about the learner's trip. They just got back. Follow this arc (one topic per turn, wait for answers):
1) Welcome them back and ask where they went (Past Simple: went, visited).
2) Ask what they did there (hiked, stayed, ate, took photos).
3) Ask how the trip felt (fun, amazing, tired, relaxing).
4) Ask one short follow-up about something they said, react warmly, then close (e.g. "Sounds amazing! Glad you're back!").
Keep replies under 15 words. Accept natural Past Simple variants.`,
    openingPrompt:
      'Start the simulation. Open as Jamie, a friend greeting someone who just returned from a trip. Follow this closely: "Hey! Welcome back! How was your trip?" Do not ask where they went yet on this first turn.',
    successCriteria: [
      'said_where_went',
      'talked_about_activities',
      'shared_feelings',
      'answered_friend_questions',
    ],
    maxTurns: 12,
    vocabDrill: [
      { word: 'Went', pronunciation: 'เวนท์', meaningTh: 'ไป (อดีตของ go)' },
      { word: 'Visited', pronunciation: 'วิ-ซิ-เทด', meaningTh: 'ไปเยี่ยม / ไปเที่ยว' },
      { word: 'Stayed', pronunciation: 'สเตด', meaningTh: 'พักอยู่' },
      { word: 'Had fun', pronunciation: 'แฮด-ฟัน', meaningTh: 'สนุก / มีความสุข' },
      { word: 'Photos', pronunciation: 'โฟ-โทส', meaningTh: 'รูปถ่าย' },
    ],
  },
  {
    simulationId: 'catch_up_old_friend_easy',
    title: 'เจอเพื่อนเก่า',
    missionNumber: 5,
    missionTitleTh: 'คุยกับเพื่อนเก่าที่ไม่ได้เจอนาน',
    scenarioTh:
      'คุณบังเอิญเจอเพื่อนเก่าที่ไม่ได้เจอกันมานาน เพื่อนชวนคุยถึงเรื่องสมัยเรียนและสิ่งที่เคยทำด้วยกัน คุณมีโอกาสเล่าความทรงจำเก่า ๆ และถามไถ่เพื่อนกลับ',
    goalsTh: [
      'เล่าว่าช่วงที่ผ่านมาเป็นอย่างไร',
      'เล่าว่าสมัยเรียนเคยทำอะไร',
      'บอกสิ่งที่ชอบ/ไม่ชอบในตอนนั้น',
      'ถามเพื่อนกลับ',
    ],
    goalsEn: [
      'Talk about how life has been lately',
      'Share what you did in school',
      'Say what you liked or disliked back then',
      'Ask your friend questions back',
    ],
    difficulty: 'easy',
    estimatedMinutes: 8,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Alex, an old school friend the learner has not seen in years. You bumped into each other. Follow this arc (one topic per turn):
1) Express surprise, catch up briefly — ask how life has been lately (work, study, where they live now).
2) Bring up school days — ask what they remember doing together or in class (Past Simple).
3) Ask what they liked or did not like about school back then.
4) After they answer, share one short memory of your own, then invite them to ask you something back. React warmly and close.
Keep it nostalgic and friendly. Replies under 15 words.`,
    openingPrompt:
      'Start the simulation. Open as Alex, an old school friend who just bumped into the learner. Follow this closely: "Oh my gosh! Is that you? It\'s Alex! Long time no see!" Do not ask any follow-up questions on this first turn.',
    successCriteria: [
      'talked_about_recent_life',
      'shared_school_memories',
      'shared_likes_dislikes',
      'asked_friend_back',
    ],
    maxTurns: 14,
    vocabDrill: [
      { word: 'Remember', pronunciation: 'รี-เมม-เบอร์', meaningTh: 'จำได้ / นึกถึง' },
      { word: 'Classmate', pronunciation: 'คลาส-เมท', meaningTh: 'เพื่อนร่วมชั้น' },
      { word: 'Used to', pronunciation: 'ยูส-ทู', meaningTh: 'เคย (ทำอะไร)' },
      { word: 'Favorite', pronunciation: 'เฟ-vor-อิท', meaningTh: 'ที่ชอบที่สุด' },
      { word: 'Long time no see', pronunciation: 'ลอง-ไทม์-โน-ซี', meaningTh: 'ไม่ได้เจอกันนานเลย' },
    ],
  },
  {
    simulationId: 'explain_what_happened_easy',
    title: 'อธิบายเรื่องที่เกิดขึ้น',
    missionNumber: 7,
    missionTitleTh: 'อธิบายว่าเกิดอะไรขึ้น',
    scenarioTh:
      'วันนี้คุณมาสายและมีเรื่องไม่คาดคิดเกิดขึ้นระหว่างทาง เพื่อนร่วมงานถามว่าเกิดอะไรขึ้น คุณต้องอธิบายว่าเกิดอะไรขึ้น ทำไมถึงมาสาย และบอกว่าคุณรู้สึกอย่างไร',
    goalsTh: [
      'บอกว่าเกิดอะไรขึ้น',
      'อธิบายสาเหตุ',
      'บอกว่าคุณแก้ปัญหาอย่างไร',
      'บอกความรู้สึกตอนนั้น',
    ],
    goalsEn: [
      'Say what happened',
      'Explain why',
      'Say how you fixed the problem',
      'Share how you felt',
    ],
    difficulty: 'easy',
    estimatedMinutes: 8,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Taylor, a friendly coworker. The learner arrived late after a chaotic morning. Follow this arc (one topic per turn):
1) Notice they are late — ask what happened (What happened?).
2) Ask why it happened — guide them to use because / so (e.g. traffic, missed bus, rain).
3) Ask how they solved it or what they did next.
4) Ask how they felt (stressed, tired, worried, relieved). React with empathy and close warmly.
Keep replies under 15 words. Accept because / so patterns.`,
    openingPrompt:
      'Start the simulation. Open as Taylor, a coworker noticing the learner is late. Follow this closely: "Hey, you\'re late! Is everything okay?" Do not ask for details yet on this first turn.',
    successCriteria: [
      'explained_what_happened',
      'explained_cause',
      'explained_solution',
      'shared_feelings',
    ],
    maxTurns: 12,
    vocabDrill: [
      { word: 'Late', pronunciation: 'เลท', meaningTh: 'สาย' },
      { word: 'Because', pronunciation: 'บี-คอส', meaningTh: 'เพราะว่า' },
      { word: 'Traffic', pronunciation: 'แทรฟ-ฟิก', meaningTh: 'รถติด' },
      { word: 'Missed the bus', pronunciation: 'มิสท์-ดะ-บัส', meaningTh: 'พลาดรถเมล์' },
      { word: 'Stressed', pronunciation: 'สเตรสท', meaningTh: 'เครียด' },
    ],
  },
  {
    simulationId: 'what_were_you_doing_easy',
    title: 'เมื่อคืนทำอะไรอยู่',
    missionNumber: 8,
    missionTitleTh: 'เมื่อคืนคุณกำลังทำอะไรอยู่',
    scenarioTh:
      'เช้าวันนี้คุณกำลังคุยกับเพื่อนเรื่องเมื่อคืน ต่างคนต่างเล่าว่ากำลังทำอะไรอยู่ และเกิดอะไรขึ้นระหว่างนั้น',
    goalsTh: [
      'ตอบว่าเมื่อคืนกำลังทำอะไร',
      'ถามว่าเพื่อนเมื่อคืนกำลังทำอะไร',
      'ถามว่าอีกคนกำลังทำอะไร',
      'ถามว่าเกิดอะไรขึ้น',
    ],
    goalsEn: [
      'Say what you were doing last night',
      'Ask what your friend was doing last night',
      'Ask what someone else was doing',
      'Ask what happened',
    ],
    difficulty: 'easy',
    estimatedMinutes: 8,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Sam, a friend chatting about last night. Follow this arc closely (one step per turn, wait for the learner before moving on):
1) Open by asking what they were doing last night. When they answer with Past Continuous (e.g. "I was watching TV."), react warmly: "Oh, nice!"
2) Wait for them to ask you: "What were you doing last night?" Then answer: "I was cooking dinner."
3) Mention your brother was home too. Wait for them to ask: "What was your brother doing?" Then answer: "He was playing games."
4) Wait for them to ask: "What happened?" Then answer: "The lights went out." Close warmly (e.g. "What a night!").
Do NOT skip or reorder these steps. Keep every reply under 15 words. Accept natural Past Continuous variants.`,
    openingPrompt:
      'Start the simulation. Open as Sam, a friend chatting in the morning about last night. Follow this closely: "Good morning! What were you doing last night?" Do not answer for the learner or ask anything else on this first turn.',
    successCriteria: [
      'said_what_doing',
      'asked_friend_doing',
      'asked_someone_else_doing',
      'asked_what_happened',
    ],
    maxTurns: 14,
    vocabDrill: [
      { word: 'Last night', pronunciation: 'ลาสท-ไนท์', meaningTh: 'เมื่อคืน' },
      { word: 'Was watching', pronunciation: 'วอส-วอช-ชิง', meaningTh: 'กำลังดู (อดีต)' },
      { word: 'Was cooking', pronunciation: 'วอส-คุ-กิง', meaningTh: 'กำลังทำอาหาร' },
      { word: 'When', pronunciation: 'เวน', meaningTh: 'เมื่อ / ตอนที่' },
      { word: 'What were you doing?', pronunciation: 'ว็อท-เวอร์-ยู-ดู-อิง', meaningTh: 'คุณกำลังทำอะไรอยู่?' },
    ],
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
  // Coffee: drink + price question ready before forcing payment_completed.
  const drinkDone =
    (!config.successCriteria.includes('ordered_drink') ||
      checkpoints.ordered_drink) &&
    (!config.successCriteria.includes('user_specified_drink') ||
      checkpoints.user_specified_drink);
  const priceDone =
    (!config.successCriteria.includes('asked_price') ||
      checkpoints.asked_price) &&
    (!config.successCriteria.includes('user_specified_size_or_milk') ||
      checkpoints.user_specified_size_or_milk);
  return drinkDone && priceDone;
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

type TurnLike = { speaker: string; textEn: string };

/** Code-side checkpoint hints when Gemini is slow to mark social missions complete. */
export function applySimulationCheckpointHeuristics(
  config: SimulationConfig,
  userText: string,
  history: TurnLike[],
  checkpoints: Record<string, boolean>,
): Record<string, boolean> {
  switch (config.simulationId) {
    case 'meet_new_friend_easy':
      return applyMeetNewFriendHeuristics(userText, history, checkpoints);
    default:
      return checkpoints;
  }
}

function applyMeetNewFriendHeuristics(
  userText: string,
  history: TurnLike[],
  checkpoints: Record<string, boolean>,
): Record<string, boolean> {
  const next = { ...checkpoints };
  const t = userText.toLowerCase().trim();
  const userTurnCount = history.filter((turn) => turn.speaker === 'user').length;

  if (!next.introduced_self) {
    if (
      /\b(i'?m|i am|my name is|call me)\b/.test(t) ||
      /\b(nice to meet you|hello|hi)\b/.test(t)
    ) {
      next.introduced_self = true;
    }
  }

  if (!next.answered_about_self && userTurnCount >= 2) {
    if (
      /\b(from|live|work|study|student|school|job|like|love|enjoy|hobby|play|watch|read)\b/.test(
        t,
      ) ||
      t.split(/\s+/).length >= 4
    ) {
      next.answered_about_self = true;
    }
  }

  if (!next.got_to_know_friend) {
    const lastAi = [...history].reverse().find((turn) => turn.speaker === 'ai');
    if (
      lastAi &&
      /\b(i'?m|i am|my name|i like|i love|i work|i study)\b/.test(
        lastAi.textEn.toLowerCase(),
      )
    ) {
      next.got_to_know_friend = true;
    }
    if (/\b(you|your|max)\b/.test(t) && /\?/.test(userText)) {
      next.got_to_know_friend = true;
    }
    if (
      userTurnCount >= 5 &&
      next.introduced_self &&
      next.answered_about_self
    ) {
      next.got_to_know_friend = true;
    }
  }

  return next;
}

/** Force wrap-up when near max turns or checkpoints are done but Gemini keeps chatting. */
export function finalizeSimulationTurnState(
  config: SimulationConfig,
  nextTurn: number,
  checkpoints: Record<string, boolean>,
  reply: { aiResponse: string; textTh: string },
): {
  checkpoints: Record<string, boolean>;
  reply: { aiResponse: string; textTh: string };
  isTaskComplete: boolean;
} {
  const maxTurns = config.maxTurns;
  const maxTurnsReached = nextTurn >= maxTurns;
  const remainingTurns = maxTurns - nextTurn;
  const merged = { ...checkpoints };
  let aiResponse = reply.aiResponse;
  let textTh = reply.textTh;

  const completedCount = Object.values(merged).filter(Boolean).length;
  const shouldForceClose =
    maxTurnsReached ||
    (remainingTurns <= 2 && completedCount >= 2) ||
    (allCheckpointsComplete(merged) && remainingTurns <= 2);

  if (shouldForceClose) {
    for (const key of config.successCriteria) {
      merged[key] = true;
    }
    const looksLikeClosing =
      /nice talking|see you|goodbye|great meeting|take care|lovely meeting/i.test(
        aiResponse,
      );
    const stillAsking = /\?/.test(aiResponse);
    if (!looksLikeClosing && (maxTurnsReached || stillAsking)) {
      aiResponse = 'Nice talking to you! See you around the park!';
      textTh = 'ยินดีที่ได้คุยด้วยนะครับ! แล้วเจอกันในสวนครับ!';
    }
  }

  const isTaskComplete =
    allCheckpointsComplete(merged) || maxTurnsReached || shouldForceClose;

  return {
    checkpoints: merged,
    reply: { aiResponse, textTh },
    isTaskComplete,
  };
}
