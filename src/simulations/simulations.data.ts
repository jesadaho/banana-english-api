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
      'สั่งเครื่องดื่มของคุณ',
      'เลือกขนาดหรือนม',
      'ชำระเงินให้เรียบร้อย',
    ],
    goalsEn: [
      'Order your drink',
      'Choose your size or milk',
      'Complete your payment',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Sam, a friendly barista at a busy NYC coffee shop. Ask what they would like, then prompt for size or milk. When they want to pay by card (even if STT garbles it, e.g. "hard plates" = "card please"), complete payment in that turn — never ask them to tap the screen. Close like: "Card, got it! Payment completed. Here is your latte! Enjoy your day!"`,
    successCriteria: [
      'user_specified_drink',
      'user_specified_size_or_milk',
      'payment_completed',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Latte', pronunciation: 'ลา-เท', meaningTh: 'กาแฟลาเต้' },
      { word: 'Espresso', pronunciation: 'เอส-เพรส-โซ', meaningTh: 'กาแฟเอสเพรสโซ' },
      { word: 'Iced', pronunciation: 'ไอซด์', meaningTh: 'เย็น / แบบเย็น' },
      { word: 'Receipt', pronunciation: 'ริ-ซีท', meaningTh: 'ใบเสร็จ' },
      { word: 'Sugar', pronunciation: 'ชู-เกอร์', meaningTh: 'น้ำตาล' },
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
      'เลือกเครื่องดื่มหรือเครื่องเคียง',
      'ยืนยันออเดอร์',
    ],
    goalsEn: [
      'Order your meal',
      'Choose your drink or side',
      'Confirm your order',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Mia, a friendly restaurant server. Lead with questions like: "Are you ready to order?" "What would you like to drink?" "Anything else?" Guide them to order a meal, choose a drink or side, then confirm the full order.`,
    successCriteria: [
      'ordered_meal',
      'chose_drink_or_side',
      'confirmed_order',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Appetizer', pronunciation: 'แอพ-พิ-ไท-เซอร์', meaningTh: 'อาหารเรียกน้ำย่อย' },
      { word: 'Beverage', pronunciation: 'เบฟ-เวอ-ริจ', meaningTh: 'เครื่องดื่ม' },
      { word: 'Medium rare', pronunciation: 'มี-เดียม-แรร์', meaningTh: 'สุกปานกลางค่อนดิบ' },
      { word: 'Allergic', pronunciation: 'อะ-เลอร์-จิก', meaningTh: 'แพ้ (อาหาร)' },
      { word: 'Bill', pronunciation: 'บิล', meaningTh: 'บิล / ใบเสร็จค่าอาหาร' },
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
      'เช็กอินเข้าพักโรงแรม',
      'ยืนยันการจอง',
      'รับกุญแจห้อง',
    ],
    goalsEn: [
      'Check in to your hotel',
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
      'บอกจุดหมายให้คนขับ',
      'ยืนยันรายละเอียดการเดินทาง',
      'ชำระค่าโดยสาร',
    ],
    goalsEn: [
      'Tell the driver your destination',
      'Confirm your trip details',
      'Complete the ride',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      `${AI_LEAD} You are Carlos, a taxi driver. Lead with questions like: "Where are you going?" "Cash or card?" "Is this the correct destination?" Guide them to state destination, confirm trip details, and complete the ride.`,
    successCriteria: [
      'stated_destination',
      'confirmed_trip_details',
      'completed_ride',
    ],
    maxTurns: 8,
    vocabDrill: [
      { word: 'Destination', pronunciation: 'เดส-ทิ-เน-ชั่น', meaningTh: 'จุดหมายปลายทาง' },
      { word: 'Fare', pronunciation: 'แฟร์', meaningTh: 'ค่าโดยสาร' },
      { word: 'Meter', pronunciation: 'มี-เทอร์', meaningTh: 'มิเตอร์แท็กซี่' },
      { word: 'Intersection', pronunciation: 'อิน-เทอร์-เซ็ก-ชั่น', meaningTh: 'สี่แยก / ทางแยก' },
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
