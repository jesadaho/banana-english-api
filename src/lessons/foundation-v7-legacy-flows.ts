import type { V7TeachingStep } from './foundation-v7-lessons.data';
const icons: Record<string, string> = { coffee: '☕', tea: '🍵', water: '💧', rice: '🍚', noodles: '🍜', bread: '🍞', Please: '🙏', 'Thank you': '💝', Sorry: '😔', 'Excuse me': '🙋', 'Please say that again': '🔁', 'Please speak slowly': '🐢', 'I do not understand': '🤔' };
const SHORT = 'ดีครับ ';
const recap = (en: string, th: string) => en + ' แปลว่า “' + th + '” ครับ ';

// V1 pacing: teach a small chunk, use it immediately, then transfer it.
const task = (text: string, expectedSpeech: string, labels: string[] = [], stem = '', any = false, successText?: string, incorrectHintTh?: string): V7TeachingStep => ({
  kind: 'recall', instruction: text, expectsUserSpeech: true, expectedSpeech,
  presentation: { text, answerMode: any ? 'any' : 'single', options: labels.map(label => ({
    emoji: icons[label] ?? '🔢', label, speak: stem + label,
  })), stem, successText, incorrectHintTh },
});
const choiceTask = (
  text: string,
  expectedSpeech: string,
  stem: string,
  options: Array<{ emoji: string; label: string; speak: string; meaningTh?: string; recapText?: string }>,
  successText?: string,
  any = false,
  incorrectHintTh?: string,
): V7TeachingStep => ({
  kind: 'recall', instruction: text, expectsUserSpeech: true, expectedSpeech,
  presentation: { text, answerMode: any ? 'any' : 'single', options, stem, successText, incorrectHintTh },
});
const finish = (text: string): V7TeachingStep => ({ kind: 'complete', instruction: text,
  expectsUserSpeech: false, presentation: { text, answerMode: 'single', options: [], stem: '' } });

export const V7_LEGACY_FLOWS: Record<string, V7TeachingStep[]> = {
  fnd_v7_i_am_you_are: [
    task('วันนี้เราจะฝึกบอกความรู้สึกของตัวเองและอีกฝ่ายครับ ถ้าพูดถึงตัวเอง เริ่มด้วย I am… “ฉันพร้อม” พูดว่า I am ready. ลองพูดตามครับ', 'I am ready.', [], '', false,
      'ถูกต้องครับ '),
    choiceTask('คราวนี้ถ้าจะบอกว่า “ฉันมีความสุข” ต้องเติมคำไหน? 😊 เลือกแล้วพูดประโยคเต็มครับ', 'I am happy.', 'I ... happy.', [
      { emoji: '😊', label: 'am', speak: 'I am happy.' },
      { emoji: '💬', label: 'are', speak: 'I are happy.' },
    ], 'I am happy. แปลว่า “ฉันมีความสุข” ครับ ', false, 'ใช้ am กับ I แล้วพูดว่า I am happy. ครับ'),
    task('เมื่อพูดกับอีกฝ่าย ใช้ You are… “คุณพร้อม” พูดว่า You are ready. ลองพูดตามครับ', 'You are ready.', [], '', false,
      'ดีครับ '),
    choiceTask('สมมติว่าคุณกำลังพูดกับเพื่อนว่า “คุณเหนื่อย” 😴 ต้องเติมคำไหน? เลือกแล้วพูดประโยคเต็มครับ', 'You are tired.', 'You ... tired.', [
      { emoji: '💬', label: 'am', speak: 'You am tired.' },
      { emoji: '😴', label: 'are', speak: 'You are tired.' },
    ], 'You are tired. แปลว่า “คุณเหนื่อย” ครับ ', false, 'ใช้ are กับ You แล้วพูดว่า You are tired. ครับ'),
    choiceTask('คราวนี้คุณอยากบอกว่า “ฉันหิว” 🍽️ ควรเริ่มด้วยอะไร?', 'I am hungry.', '... hungry.', [
      { emoji: '👤', label: 'I am', speak: 'I am hungry.' },
      { emoji: '👉', label: 'You are', speak: 'You are hungry.' },
    ], 'I am hungry. แปลว่า “ฉันหิว” ครับ ', false, 'พูดถึงตัวเองใช้ I am แล้วพูดว่า I am hungry. ครับ'),
    choiceTask('ลองเลือกบอกความรู้สึกของตัวเองหนึ่งอย่าง จะตอบตามจริงหรือสมมติก็ได้ครับ', 'I am happy.', 'I am ...', [
      { emoji: '😊', label: 'happy', speak: 'I am happy.', meaningTh: 'ฉันมีความสุข' },
      { emoji: '😴', label: 'tired', speak: 'I am tired.', meaningTh: 'ฉันเหนื่อย' },
      { emoji: '🍽️', label: 'hungry', speak: 'I am hungry.', meaningTh: 'ฉันหิว' },
      { emoji: '✅', label: 'ready', speak: 'I am ready.', meaningTh: 'ฉันพร้อม' },
    ], undefined, true, 'เลือกความรู้สึกแล้วพูดประโยคเต็มครับ'),
    finish('จบบทแล้วครับ วันนี้เราได้ฝึกใช้ I am… พูดถึงตัวเอง และ You are… พูดกับอีกฝ่าย'),
  ],
  fnd_v7_not_and_are_you: [
    task('วันนี้เราจะฝึกบอกว่า “ไม่” และถามความรู้สึกของอีกฝ่ายครับ I am tired. แปลว่า “ฉันเหนื่อย” เติม not หลัง am เป็น I am not tired. แปลว่า “ฉันไม่เหนื่อย” ลองพูดว่า I am not tired. ครับ', 'I am not tired.', [], '', false,
      'ถูกต้องครับ '),
    choiceTask('คราวนี้สมมติว่าคุณอิ่มแล้วครับ 🍽️ ถ้าจะบอกว่า “ฉันไม่หิว” ต้องเลือกคำไหน? พูดประโยคเต็มได้เลยครับ', 'I am not hungry.', 'I am not ...', [
      { emoji: '🍽️', label: 'hungry', speak: 'I am not hungry.' },
      { emoji: '😴', label: 'tired', speak: 'I am not tired.' },
    ], 'I am not hungry. แปลว่า “ฉันไม่หิว” ครับ ', false, 'อิ่มแล้วใช้ hungry แล้วพูดว่า I am not hungry. ครับ'),
    task('ถ้าจะถามว่า “คุณเหนื่อยไหม” ใช้ Are you tired? สังเกตว่า You are สลับเป็น Are you เมื่อถามครับ ลองพูดว่า Are you tired?', 'Are you tired?', [], '', false,
      'ถูกต้องครับ '),
    choiceTask('ก่อนเริ่มเกม คุณอยากถามเพื่อนว่า “คุณพร้อมไหม” 🎮 เลือกคำแล้วพูดคำถามเต็มครับ', 'Are you ready?', 'Are you ...?', [
      { emoji: '✅', label: 'ready', speak: 'Are you ready?' },
      { emoji: '🍽️', label: 'hungry', speak: 'Are you hungry?' },
    ], 'Are you ready? แปลว่า “คุณพร้อมไหม” ครับ ', false, 'ถามว่าพร้อมไหม ใช้ ready แล้วพูดว่า Are you ready? ครับ'),
    task('ถ้าพร้อม ตอบสั้น ๆ ว่า Yes, I am. หมายถึง “ใช่ ฉันพร้อม” สมมติว่าคุณพร้อมแล้ว ลองตอบครูครับ: Are you ready?', 'Yes, I am.', [], '', false,
      'ถูกต้องครับ '),
    task('ถ้าไม่พร้อม ตอบว่า No, I am not. หมายถึง “ไม่ ฉันยังไม่พร้อม” รอบนี้สมมติว่ายังไม่พร้อมนะครับ: Are you ready?', 'No, I am not.', [], '', false,
      'ดีครับ '),
    choiceTask('คราวนี้ตอบตามตัวเองได้เลย 😴 Are you tired?', 'Yes, I am.', '', [
      { emoji: '🙂', label: 'Yes', speak: 'Yes, I am.', recapText: 'Yes, I am. ในคำถามนี้หมายถึง “ใช่ ฉันเหนื่อย” ครับ ' },
      { emoji: '🙅', label: 'No', speak: 'No, I am not.', recapText: 'No, I am not. ในคำถามนี้หมายถึง “ไม่ ฉันไม่เหนื่อย” ครับ ' },
    ], undefined, true, 'ตอบสั้น ๆ ว่า Yes, I am. หรือ No, I am not. ครับ'),
    finish('จบบทแล้วครับ วันนี้เราได้ฝึกบอกว่าไม่ ถามความรู้สึก และตอบสั้น ๆ'),
  ],
  fnd_v7_he_she_it_we_they: [
    task('เวลาเราพูดถึงคนเดิม เราไม่ต้องเรียกชื่อเขาทุกครั้งครับ Ben เป็นครูผู้ชาย 👨‍🏫 เราใช้คำว่า he แทนชื่อ Ben ได้ “He is a teacher.” แปลว่าเขาเป็นครู ลองพูดตามครับ', 'He is a teacher.', [], '', false, SHORT),
    task('คราวนี้ Anna เป็นครูผู้หญิงครับ 👩‍🏫 เราใช้คำว่า she แทนชื่อ Anna ได้ “She is a teacher.” แปลว่าเธอเป็นครู ลองพูดตามครับ', 'She is a teacher.', [], '', false, SHORT),
    choiceTask('ลองพูดถึง Anna ว่าเธอเป็นครูครับ ควรเริ่มด้วยคำไหน?', 'She is a teacher.', '... is a teacher.', [
      { emoji: '👨‍🏫', label: 'He', speak: 'He is a teacher.' },
      { emoji: '👩‍🏫', label: 'She', speak: 'She is a teacher.' },
    ], recap('She is a teacher.', 'เธอเป็นครู'), false, 'Anna เป็นผู้หญิง ใช้ She แล้วพูดว่า She is a teacher. ครับ'),
    task('ต่อไปเป็นกระเป๋าหนึ่งใบครับ 🎒 กระเป๋าคือ bag ใช้ it พูดถึงสิ่งของ “It is a bag.” แปลว่ามันคือกระเป๋า ลองพูดตามครับ', 'It is a bag.', [], '', false, SHORT),
    task('ต่อไปเป็นกลุ่มคนครับ ลองดูว่ามีตัวเรารวมอยู่ด้วยไหม สมมติว่าคุณกับเพื่อนเป็นนักเรียนทั้งคู่ 🧑‍🎓🧑‍🎓 กลุ่มนี้มีคุณรวมอยู่ จึงใช้ we กับ are “We are students.” แปลว่าพวกเราเป็นนักเรียน ลองพูดตามครับ', 'We are students.', [], '', false, SHORT),
    task('คราวนี้คุณกำลังพูดถึงนักเรียนอีกสองคน โดยไม่ได้รวมตัวคุณเองครับ ใช้ they กับคนกลุ่มนั้น “They are students.” แปลว่าพวกเขาเป็นนักเรียน ลองพูดตามครับ', 'They are students.', [], '', false, SHORT),
    choiceTask('คราวนี้คุณอยู่ในกลุ่มนักเรียนด้วย จะบอกว่าพวกเราเป็นนักเรียนอย่างไรครับ?', 'We are students.', '... are students.', [
      { emoji: '🫵', label: 'We', speak: 'We are students.' },
      { emoji: '👉', label: 'They', speak: 'They are students.' },
    ], recap('We are students.', 'พวกเราเป็นนักเรียน'), false, 'กลุ่มนี้มีคุณรวมอยู่ ใช้ We แล้วพูดว่า We are students. ครับ'),
    choiceTask('คุณกำลังพูดถึงนักเรียนอีกกลุ่มหนึ่งที่ไม่มีคุณอยู่ด้วยครับ ลองบอกว่าพวกเขาเป็นนักเรียน', 'They are students.', '... are students.', [
      { emoji: '🫵', label: 'We', speak: 'We are students.' },
      { emoji: '👉', label: 'They', speak: 'They are students.' },
    ], recap('They are students.', 'พวกเขาเป็นนักเรียน'), false, 'กลุ่มนี้ไม่มีคุณ ใช้ They แล้วพูดว่า They are students. ครับ'),
    finish('จบบทครับ เราฝึก he กับผู้ชาย she กับผู้หญิง it กับสิ่งของ we เมื่อรวมตัวเรา และ they เมื่อพูดถึงคนกลุ่มอื่น'),
  ],
  fnd_v7_my_family: [
    task('วันนี้เราจะฝึกแนะนำคนในครอบครัวครับ 👨‍👩‍👧 ใช้ This is my… แล้วเติมคนที่อยากแนะนำ “This is my mother.” แปลว่านี่คือแม่ของฉัน ลองพูดตามครับ', 'This is my mother.', [], '', false, SHORT),
    choiceTask('คราวนี้สมมติว่าคุณกำลังแนะนำพ่อครับ ลองเปลี่ยนคำท้าย', 'This is my father.', 'This is my ...', [
      { emoji: '👩', label: 'mother', speak: 'This is my mother.' },
      { emoji: '👨', label: 'father', speak: 'This is my father.' },
    ], recap('This is my father.', 'นี่คือพ่อของฉัน'), false, 'แนะนำพ่อใช้ father แล้วพูดว่า This is my father. ครับ'),
    choiceTask('ลองแนะนำพี่ชายหรือน้องชายของคุณครับ จะเป็นคนสมมติก็ได้', 'This is my brother.', 'This is my ...', [
      { emoji: '👦', label: 'brother', speak: 'This is my brother.' },
      { emoji: '👧', label: 'sister', speak: 'This is my sister.' },
    ], recap('This is my brother.', 'นี่คือพี่ชายหรือน้องชายของฉัน'), false, 'พี่ชายหรือน้องชายใช้ brother แล้วพูดว่า This is my brother. ครับ'),
    choiceTask('แล้วถ้าจะแนะนำพี่สาวหรือน้องสาวล่ะครับ?', 'This is my sister.', 'This is my ...', [
      { emoji: '👦', label: 'brother', speak: 'This is my brother.' },
      { emoji: '👧', label: 'sister', speak: 'This is my sister.' },
    ], recap('This is my sister.', 'นี่คือพี่สาวหรือน้องสาวของฉัน'), false, 'พี่สาวหรือน้องสาวใช้ sister แล้วพูดว่า This is my sister. ครับ'),
    choiceTask('เลือกแนะนำสมาชิกหนึ่งคนได้เลยครับ ใช้ครอบครัวจริงหรือสมมติก็ได้', 'This is my mother.', 'This is my ...', [
      { emoji: '👩', label: 'mother', speak: 'This is my mother.', meaningTh: 'นี่คือแม่ของฉัน' },
      { emoji: '👨', label: 'father', speak: 'This is my father.', meaningTh: 'นี่คือพ่อของฉัน' },
      { emoji: '👧', label: 'sister', speak: 'This is my sister.', meaningTh: 'นี่คือพี่สาวหรือน้องสาวของฉัน' },
      { emoji: '👦', label: 'brother', speak: 'This is my brother.', meaningTh: 'นี่คือพี่ชายหรือน้องชายของฉัน' },
    ], undefined, true, 'เลือกสมาชิกแล้วพูดประโยคเต็ม This is my… ครับ'),
    finish('จบบทครับ วันนี้คุณนำคำเรียกสมาชิกครอบครัวมาใช้แนะนำคนด้วย This is my…'),
  ],
  fnd_v7_one_or_more: [
    task('วันนี้เราจะบอกของหนึ่งชิ้นกับหลายชิ้นครับ 📖 หนังสือหนึ่งเล่มพูดว่า “a book” ลองพูดตามครับ', 'a book', [], '', false, SHORT),
    task('ถ้ามีหลายเล่ม ใช้ “books” เติม s และไม่ใช้ a ครับ 📚 ลองพูด books', 'books', [], '', false, SHORT),
    choiceTask('สมมติว่าบนโต๊ะมีหนังสือหลายเล่มครับ 📚 เลือกแล้วพูดให้ตรงจำนวน', 'books', '', [
      { emoji: '📖', label: 'a book', speak: 'a book' },
      { emoji: '📚', label: 'books', speak: 'books' },
    ], recap('books', 'หนังสือหลายเล่ม'), false, 'หลายเล่มใช้ books ไม่ใช้ a ครับ'),
    task('แอปเปิลหนึ่งลูกพูดว่า “an apple” ครับ 🍎 apple เริ่มด้วยเสียงสระ จึงใช้ an ลองพูด an apple', 'an apple', [], '', false, SHORT),
    task('ถ้ามีหลายลูก เติม s เป็น “apples” ครับ 🍎🍎 ลองพูด apples', 'apples', [], '', false, SHORT),
    choiceTask('คราวนี้มีแอปเปิลแค่หนึ่งลูกครับ 🍎 ควรพูดแบบไหน?', 'an apple', '', [
      { emoji: '🍎', label: 'an apple', speak: 'an apple' },
      { emoji: '🍎🍎', label: 'apples', speak: 'apples' },
    ], recap('an apple', 'แอปเปิลหนึ่งลูก'), false, 'หนึ่งลูกใช้ an apple ครับ'),
    task('บนโต๊ะมีหนังสือแค่หนึ่งเล่มครับ 📖 ลองบอกเอง', 'a book', [], '', false, recap('a book', 'หนังสือหนึ่งเล่ม')),
    finish('จบบทครับ วันนี้ฝึก a book กับ books และ an apple กับ apples แล้ว'),
  ],
  fnd_v7_this_is_that_is: [
    task('เวลาเราชี้ของ ภาษาอังกฤษช่วยบอกได้ว่าของอยู่ใกล้หรือไกลจากคนพูดครับ สมมติว่าหนังสืออยู่ในมือคุณ 📖 ของใกล้ใช้ this “This is a book.” แปลว่านี่คือหนังสือ ลองพูดตามครับ', 'This is a book.', [], '', false, SHORT),
    task('คราวนี้หนังสืออยู่ไกลอีกฝั่งห้องครับ ของไกลใช้ that “That is a book.” แปลว่านั่นคือหนังสือ ลองพูดตามครับ', 'That is a book.', [], '', false, SHORT),
    choiceTask('หนังสือกลับมาอยู่ในมือคุณแล้วครับ จะเริ่มด้วยคำไหน?', 'This is a book.', '... is a book.', [
      { emoji: '👇', label: 'This', speak: 'This is a book.' },
      { emoji: '👉', label: 'That', speak: 'That is a book.' },
    ], recap('This is a book.', 'นี่คือหนังสือ'), false, 'ของใกล้ใช้ This แล้วพูดว่า This is a book. ครับ'),
    choiceTask('มีกระเป๋าอยู่ไกลอีกฝั่งห้องครับ ลองบอกว่านั่นคือกระเป๋า', 'That is a bag.', '... is a bag.', [
      { emoji: '👇', label: 'This', speak: 'This is a bag.' },
      { emoji: '👉', label: 'That', speak: 'That is a bag.' },
    ], recap('That is a bag.', 'นั่นคือกระเป๋า'), false, 'ของไกลใช้ That แล้วพูดว่า That is a bag. ครับ'),
    task('ตอนนี้คุณถือกระเป๋าอยู่ครับ ลองบอกว่านี่คือกระเป๋าเอง', 'This is a bag.', [], '', false, recap('This is a bag.', 'นี่คือกระเป๋า')),
    finish('จบบทครับ ใช้ this กับของใกล้ และ that กับของไกลจากตัวผู้พูด'),
  ],
  fnd_v7_colours_and_size: [
    task('วันนี้เราจะบอกสีและขนาดของกระเป๋าครับ สมมติว่ากระเป๋าเป็นสีน้ำเงิน 🔵 “It is blue.” แปลว่ามันเป็นสีน้ำเงิน ลองพูดตามครับ', 'It is blue.', [], '', false, SHORT),
    choiceTask('เปลี่ยนเป็นกระเป๋าสีเขียวครับ 🟢 ลองบอกสี', 'It is green.', 'It is ...', [
      { emoji: '🔴', label: 'red', speak: 'It is red.' },
      { emoji: '🔵', label: 'blue', speak: 'It is blue.' },
      { emoji: '🟢', label: 'green', speak: 'It is green.' },
    ], recap('It is green.', 'มันเป็นสีเขียว'), false, 'สีเขียวใช้ green แล้วพูดว่า It is green. ครับ'),
    task('ต่อไปเรื่องขนาดครับ big แปลว่าใหญ่ “It is big.” แปลว่ามันใหญ่ ลองพูดตามครับ', 'It is big.', [], '', false, SHORT),
    task('small แปลว่าเล็กครับ “It is small.” แปลว่ามันเล็ก ลองพูดตามครับ', 'It is small.', [], '', false, SHORT),
    choiceTask('สมมติว่ากระเป๋าใบนี้เล็กครับ ควรเลือกคำไหน?', 'It is small.', 'It is ...', [
      { emoji: '🐘', label: 'big', speak: 'It is big.' },
      { emoji: '🐭', label: 'small', speak: 'It is small.' },
    ], recap('It is small.', 'มันเล็ก'), false, 'เล็กใช้ small แล้วพูดว่า It is small. ครับ'),
    choiceTask('เลือกสีให้กระเป๋าของคุณหนึ่งสี แล้วพูดบอกสีครับ', 'It is red.', 'It is ...', [
      { emoji: '🔴', label: 'red', speak: 'It is red.', meaningTh: 'มันเป็นสีแดง' },
      { emoji: '🔵', label: 'blue', speak: 'It is blue.', meaningTh: 'มันเป็นสีน้ำเงิน' },
      { emoji: '🟢', label: 'green', speak: 'It is green.', meaningTh: 'มันเป็นสีเขียว' },
    ], undefined, true, 'เลือกสีแล้วพูดว่า It is… ครับ'),
    finish('จบบทครับ เราใช้ It is… บอกสีและขนาดของสิ่งของแล้ว'),
  ],
  fnd_v7_these_and_those: [
    task('ครั้งก่อนเราชี้ของหนึ่งชิ้น วันนี้ถ้ามีหลายชิ้น คำที่ใช้ก็เปลี่ยนครับ หนังสือหลายเล่มอยู่ใกล้มือคุณ 📚 เปลี่ยนจาก this is เป็น these are “These are books.” แปลว่าเหล่านี้คือหนังสือ ลองพูดตามครับ', 'These are books.', [], '', false, SHORT),
    task('หนังสือหลายเล่มอยู่ไกลอีกฝั่งห้องครับ เมื่อของไกลมีหลายชิ้น เปลี่ยนจาก that is เป็น those are “Those are books.” แปลว่าเหล่านั้นคือหนังสือ ลองพูดตามครับ', 'Those are books.', [], '', false, SHORT),
    choiceTask('หนังสือหลายเล่มอยู่ตรงหน้าคุณครับ ควรเริ่มด้วยคำไหน?', 'These are books.', '... are books.', [
      { emoji: '👇', label: 'These', speak: 'These are books.' },
      { emoji: '👉', label: 'Those', speak: 'Those are books.' },
    ], recap('These are books.', 'เหล่านี้คือหนังสือ'), false, 'ของหลายชิ้นที่อยู่ใกล้ใช้ These แล้วพูดว่า These are books. ครับ'),
    choiceTask('คราวนี้กระเป๋าหลายใบอยู่ไกลอีกฝั่งห้องครับ ลองบอกว่าเหล่านั้นคือกระเป๋า', 'Those are bags.', '... are bags.', [
      { emoji: '👇', label: 'These', speak: 'These are bags.' },
      { emoji: '👉', label: 'Those', speak: 'Those are bags.' },
    ], recap('Those are bags.', 'เหล่านั้นคือกระเป๋า'), false, 'ของหลายชิ้นที่อยู่ไกลใช้ Those แล้วพูดว่า Those are bags. ครับ'),
    task('ย้ายกระเป๋าหลายใบมาไว้ใกล้คุณแล้วครับ ลองบอกเอง', 'These are bags.', [], '', false, recap('These are bags.', 'เหล่านี้คือกระเป๋า')),
    finish('จบบทครับ ของหลายชิ้นใกล้ใช้ these ส่วนของหลายชิ้นไกลใช้ those'),
  ],
  fnd_v7_my_and_your: [
    task('วันนี้เราจะบอกว่าอะไรเป็นของใครครับ 📱 คำที่ใช้ขึ้นอยู่กับว่าใครเป็นคนพูด ถ้าคุณเป็นเจ้าของโทรศัพท์ ใช้ my แปลว่าของฉัน “This is my phone.” แปลว่านี่คือโทรศัพท์ของฉัน ลองพูดตามครับ', 'This is my phone.', [], '', false, SHORT),
    task('ถ้าโทรศัพท์เป็นของ Max และคุณกำลังพูดกับ Max ใช้ your แปลว่าของคุณครับ “This is your phone.” แปลว่านี่คือโทรศัพท์ของคุณ ลองพูดตามครับ', 'This is your phone.', [], '', false, SHORT),
    choiceTask('โทรศัพท์เครื่องนี้เป็นของคุณเองครับ ลองบอกครูว่าเป็นของฉัน', 'This is my phone.', 'This is ... phone.', [
      { emoji: '👤', label: 'my', speak: 'This is my phone.' },
      { emoji: '👉', label: 'your', speak: 'This is your phone.' },
    ], recap('This is my phone.', 'นี่คือโทรศัพท์ของฉัน'), false, 'ของตัวเองใช้ my แล้วพูดว่า This is my phone. ครับ'),
    choiceTask('คุณกำลังคืนโทรศัพท์ให้ Max ซึ่งเป็นเจ้าของครับ ลองพูดกับ Max ว่านี่คือโทรศัพท์ของคุณ', 'This is your phone.', 'This is ... phone.', [
      { emoji: '👤', label: 'my', speak: 'This is my phone.' },
      { emoji: '👉', label: 'your', speak: 'This is your phone.' },
    ], recap('This is your phone.', 'นี่คือโทรศัพท์ของคุณ'), false, 'พูดกับเจ้าของใช้ your แล้วพูดว่า This is your phone. ครับ'),
    choiceTask('เลือกของหนึ่งชิ้นแล้วบอกว่าเป็นของคุณเองครับ สมมติได้', 'This is my phone.', 'This is my ...', [
      { emoji: '📱', label: 'phone', speak: 'This is my phone.', meaningTh: 'นี่คือโทรศัพท์ของฉัน' },
      { emoji: '🎒', label: 'bag', speak: 'This is my bag.', meaningTh: 'นี่คือกระเป๋าของฉัน' },
      { emoji: '🔑', label: 'key', speak: 'This is my key.', meaningTh: 'นี่คือกุญแจของฉัน' },
    ], undefined, true, 'เลือกของแล้วพูดว่า This is my… ครับ'),
    finish('จบบทครับ my ใช้กับของตัวเอง ส่วน your ใช้กับของคนที่เราคุยด้วย'),
  ],
  fnd_v7_his_her_our_their: [
    task('เรารู้จักคำที่ใช้พูดถึงคนแล้วครับ คราวนี้เราจะบอกว่าสิ่งของเป็นของใคร Ben เป็นผู้ชายและเป็นเจ้าของกระเป๋า ใช้ his bag แปลว่ากระเป๋าของเขา “This is his bag.” แปลว่านี่คือกระเป๋าของเขา ลองพูดตามครับ', 'This is his bag.', [], '', false, SHORT),
    task('ถ้าเจ้าของคือ Anna ซึ่งเป็นผู้หญิง ใช้ her ครับ “This is her bag.” แปลว่านี่คือกระเป๋าของเธอ ลองพูดตามครับ', 'This is her bag.', [], '', false, SHORT),
    choiceTask('คุณกำลังเล่าให้ครูฟังว่ากระเป๋านี้เป็นของ Anna ครับ เลือกคำบอกเจ้าของ', 'This is her bag.', 'This is ... bag.', [
      { emoji: '👨', label: 'his', speak: 'This is his bag.' },
      { emoji: '👩', label: 'her', speak: 'This is her bag.' },
    ], recap('This is her bag.', 'นี่คือกระเป๋าของเธอ'), false, 'Anna เป็นผู้หญิง ใช้ her แล้วพูดว่า This is her bag. ครับ'),
    task('กระเป๋าใบนี้เป็นของทีมคุณร่วมกันครับ ใช้ our แปลว่าของพวกเรา “This is our bag.” แปลว่านี่คือกระเป๋าของพวกเรา ลองพูดตามครับ', 'This is our bag.', [], '', false, SHORT),
    task('ถ้าเป็นของอีกทีมหนึ่งที่ไม่มีคุณอยู่ด้วย ใช้ their ครับ “This is their bag.” แปลว่านี่คือกระเป๋าของพวกเขา ลองพูดตามครับ', 'This is their bag.', [], '', false, SHORT),
    choiceTask('กระเป๋าเป็นของทีมที่มีคุณรวมอยู่ด้วยครับ ควรเลือกคำไหน?', 'This is our bag.', 'This is ... bag.', [
      { emoji: '🫵', label: 'our', speak: 'This is our bag.' },
      { emoji: '👉', label: 'their', speak: 'This is their bag.' },
    ], recap('This is our bag.', 'นี่คือกระเป๋าของพวกเรา'), false, 'ทีมที่มีคุณรวมอยู่ใช้ our แล้วพูดว่า This is our bag. ครับ'),
    choiceTask('คราวนี้เป็นกระเป๋าของอีกทีมที่ไม่มีคุณอยู่ด้วยครับ', 'This is their bag.', 'This is ... bag.', [
      { emoji: '🫵', label: 'our', speak: 'This is our bag.' },
      { emoji: '👉', label: 'their', speak: 'This is their bag.' },
    ], recap('This is their bag.', 'นี่คือกระเป๋าของพวกเขา'), false, 'ทีมที่ไม่มีคุณใช้ their แล้วพูดว่า This is their bag. ครับ'),
    choiceTask('กลับมาที่ Ben ครับ กระเป๋าเป็นของเขา ลองบอกครูว่าเป็นของใคร', 'This is his bag.', 'This is ... bag.', [
      { emoji: '👨', label: 'his', speak: 'This is his bag.' },
      { emoji: '👩', label: 'her', speak: 'This is her bag.' },
    ], recap('This is his bag.', 'นี่คือกระเป๋าของเขา'), false, 'Ben เป็นผู้ชาย ใช้ his แล้วพูดว่า This is his bag. ครับ'),
    finish('จบบทครับ เราฝึกเลือก his, her, our และ their ตามเจ้าของแล้ว'),
  ],
  fnd_v7_have_and_has: [
    task('วันนี้เราจะบอกว่าใครมีอะไรครับ เริ่มจากคนที่มี แล้วตามด้วยสิ่งที่มี เช่นตัวคุณมีหนังสือ “I have a book.” แปลว่าฉันมีหนังสือหนึ่งเล่ม ลองพูดตามครับ', 'I have a book.', [], '', false, SHORT),
    task('ถ้าพูดถึงผู้หญิง ใช้ she กับ has ครับ “She has a book.” แปลว่าเธอมีหนังสือหนึ่งเล่ม ลองพูดตามครับ', 'She has a book.', [], '', false, SHORT),
    choiceTask('ลองบอกว่าฉันมีหนังสือหนึ่งเล่มครับ ควรเลือกคำไหน?', 'I have a book.', 'I ... a book.', [
      { emoji: '👤', label: 'have', speak: 'I have a book.' },
      { emoji: '👉', label: 'has', speak: 'I has a book.' },
    ], recap('I have a book.', 'ฉันมีหนังสือหนึ่งเล่ม'), false, 'ใช้ have กับ I แล้วพูดว่า I have a book. ครับ'),
    choiceTask('he ก็ใช้ has เหมือน she ครับ Ben มีหนังสือหนึ่งเล่ม ลองพูดถึงเขา', 'He has a book.', 'He ... a book.', [
      { emoji: '👤', label: 'have', speak: 'He have a book.' },
      { emoji: '👉', label: 'has', speak: 'He has a book.' },
    ], recap('He has a book.', 'เขามีหนังสือหนึ่งเล่ม'), false, 'ใช้ has กับ He แล้วพูดว่า He has a book. ครับ'),
    choiceTask('คราวนี้ Anna มีโทรศัพท์ครับ ลองพูดถึงเธอ', 'She has a phone.', 'She ... a phone.', [
      { emoji: '👤', label: 'have', speak: 'She have a phone.' },
      { emoji: '👉', label: 'has', speak: 'She has a phone.' },
    ], recap('She has a phone.', 'เธอมีโทรศัพท์หนึ่งเครื่อง'), false, 'ใช้ has กับ She แล้วพูดว่า She has a phone. ครับ'),
    choiceTask('เลือกของที่คุณมีหนึ่งอย่างครับ จะสมมติก็ได้', 'I have a book.', 'I have a ...', [
      { emoji: '📖', label: 'book', speak: 'I have a book.', meaningTh: 'ฉันมีหนังสือหนึ่งเล่ม' },
      { emoji: '📱', label: 'phone', speak: 'I have a phone.', meaningTh: 'ฉันมีโทรศัพท์หนึ่งเครื่อง' },
      { emoji: '🎒', label: 'bag', speak: 'I have a bag.', meaningTh: 'ฉันมีกระเป๋าหนึ่งใบ' },
    ], undefined, true, 'เลือกของแล้วพูดว่า I have a… ครับ'),
    finish('จบบทครับ วันนี้ฝึก I have และ He/She has เพื่อบอกสิ่งที่มี'),
  ],
  fnd_v7_numbers_0_10: [
    task('วันนี้เราจะฝึกนับเลขเป็นภาษาอังกฤษครับ ศูนย์ถึงห้าคือ zero, one, two, three, four, five ลองนับแอปเปิลแล้วพูดจำนวนครับ 🍎🍎🍎🍎', 'four', ['zero', 'three', 'four', 'five'], '', false, recap('four', 'สี่'), 'นับแอปเปิลในโจทย์แล้วพูด four ครับ'),
    task('ต่อไปหกถึงสิบครับ six, seven, eight, nine, ten บัตรคิวของคุณคือเลข 7 🎫 ลองอ่านเป็นภาษาอังกฤษครับ', 'seven', ['six', 'seven', 'nine', 'ten'], '', false, recap('seven', 'เจ็ด'), 'บัตรคิวเป็นเลข 7 อ่านว่า seven ครับ'),
    task('ถึงห้องหมายเลข 8 แล้วครับ 🚪 ลองอ่านเลขห้อง', 'eight', ['six', 'eight', 'nine', 'ten'], '', false, recap('eight', 'แปด'), 'ห้องหมายเลข 8 อ่านว่า eight ครับ'),
    choiceTask('เลือกเลขที่ชอบหนึ่งเลขครับ', 'three', '', [
      { emoji: '3️⃣', label: 'three', speak: 'three', meaningTh: 'สาม' },
      { emoji: '5️⃣', label: 'five', speak: 'five', meaningTh: 'ห้า' },
      { emoji: '8️⃣', label: 'eight', speak: 'eight', meaningTh: 'แปด' },
      { emoji: '🔟', label: 'ten', speak: 'ten', meaningTh: 'สิบ' },
    ], undefined, true, 'เลือกเลขแล้วพูดเป็นภาษาอังกฤษครับ'),
    finish('จบบทครับ วันนี้ฝึกนับของ อ่านเลขคิว และเลขห้องแล้ว'),
  ],
  fnd_v7_eleven_to_twenty: [
    task('วันนี้เราจะฝึกเลขสิบเอ็ดถึงยี่สิบแล้วนำไปบอกอายุครับ eleven คือสิบเอ็ด twelve คือสิบสอง ลองพูด twelve', 'twelve', [], '', false, SHORT),
    task('สิบสาม thirteen สิบสี่ fourteen สิบห้า fifteen ครับ ห้องหมายเลข 14 อ่านอย่างไร?', 'fourteen', ['thirteen', 'fourteen', 'fifteen'], '', false, recap('fourteen', 'สิบสี่'), 'ห้อง 14 อ่านว่า fourteen ครับ'),
    task('อีกห้องหนึ่งคือเลข 13 ครับ ลองอ่าน', 'thirteen', ['twelve', 'thirteen', 'fourteen'], '', false, recap('thirteen', 'สิบสาม'), 'ห้อง 13 อ่านว่า thirteen ครับ'),
    task('สิบหก sixteen สิบเจ็ด seventeen สิบแปด eighteen สิบเก้า nineteen ครับ บัตรคิวเลข 18 อ่านอย่างไร?', 'eighteen', ['sixteen', 'seventeen', 'eighteen', 'nineteen'], '', false, recap('eighteen', 'สิบแปด'), 'บัตรคิว 18 อ่านว่า eighteen ครับ'),
    task('ยี่สิบคือ twenty ครับ ลองพูด twenty', 'twenty', [], '', false, SHORT),
    task('บอกอายุได้ด้วย “I am twelve years old.” แปลว่าฉันอายุสิบสองปี ลองพูดตามครับ', 'I am twelve years old.', [], '', false, SHORT),
    task('สมมติว่าคุณอายุยี่สิบปีครับ ลองบอกอายุ', 'I am twenty years old.', [], '', false, recap('I am twenty years old.', 'ฉันอายุยี่สิบปี')),
    finish('จบบทครับ วันนี้ฝึกเลขสิบเอ็ดถึงยี่สิบและบอกอายุของตัวละครสมมติแล้ว'),
  ],
  fnd_v7_twenty_to_one_hundred: [
    task('วันนี้เราจะอ่านราคา เลขรถเมล์ และเลขห้องครับ ยี่สิบ twenty สามสิบ thirty สี่สิบ forty ห้าสิบ fifty ลองพูด forty', 'forty', [], '', false, SHORT),
    task('ป้ายราคาเขียนว่า 50 บาทครับ 🏷️ อ่านเฉพาะตัวเลขเป็นภาษาอังกฤษ', 'fifty', ['thirty', 'forty', 'fifty'], '', false, recap('fifty', 'ห้าสิบ'), 'ป้ายราคา 50 อ่านว่า fifty ครับ'),
    task('หกสิบ sixty เจ็ดสิบ seventy แปดสิบ eighty เก้าสิบ ninety ครับ ลองพูด eighty', 'eighty', [], '', false, SHORT),
    task('รถเมล์สาย 70 มาแล้วครับ 🚌 ลองอ่านเลขสาย', 'seventy', ['sixty', 'seventy', 'eighty', 'ninety'], '', false, recap('seventy', 'เจ็ดสิบ'), 'สาย 70 อ่านว่า seventy ครับ'),
    task('หนึ่งร้อยพูดว่า one hundred ครับ ลองพูดตาม', 'one hundred', [], '', false, SHORT),
    task('ประกอบเลขได้ครับ thirty กับ five เป็น thirty-five แปลว่าสามสิบห้า ลองพูด thirty-five', 'thirty-five', [], '', false, SHORT),
    task('ห้องหมายเลข 62 ครับ 🚪 ลองประกอบหลักสิบกับหลักหน่วยแล้วพูด', 'sixty-two', [], '', false, recap('sixty-two', 'หกสิบสอง')),
    finish('จบบทครับ เราฝึกหลักสิบ หนึ่งร้อย และการประกอบเลขสองหลักแล้ว'),
  ],
  fnd_v7_what_time_is_it: [
    task('วันนี้เราจะบอกเวลาและถามเวลาครับ ⏰ เวลา 7:00 พูดว่า “It is seven o’clock.” แปลว่าตอนนี้เจ็ดโมง ลองพูดตามครับ', "It is seven o'clock.", [], '', false, SHORT),
    choiceTask('เปลี่ยนเวลาเป็น 8:00 ครับ ลองบอกเวลา', "It is eight o'clock.", "... o'clock.", [
      { emoji: '🕖', label: 'seven', speak: "It is seven o'clock." },
      { emoji: '🕗', label: 'eight', speak: "It is eight o'clock." },
    ], recap("It is eight o'clock.", 'ตอนนี้แปดโมง'), false, '8:00 ใช้ eight แล้วพูดว่า It is eight o’clock. ครับ'),
    task('เวลา 7:30 อ่านชั่วโมงแล้วตามด้วยนาทีครับ “It is seven thirty.” แปลว่าตอนนี้เจ็ดโมงครึ่ง ลองพูดตามครับ', 'It is seven thirty.', [], '', false, SHORT),
    choiceTask('นาฬิกาแสดง 8:30 ครับ ลองบอกเวลา', 'It is eight thirty.', 'It is ...', [
      { emoji: '🕗', label: 'eight', speak: 'It is eight.' },
      { emoji: '🕣', label: 'eight thirty', speak: 'It is eight thirty.' },
    ], recap('It is eight thirty.', 'ตอนนี้แปดโมงครึ่ง'), false, '8:30 พูดว่า It is eight thirty. ครับ'),
    task('ถ้าอยากถามเวลา ใช้ “What time is it?” แปลว่าตอนนี้กี่โมง ลองถามครูครับ', 'What time is it?', [], '', false, SHORT + 'It is eight thirty. ตอนนี้แปดโมงครึ่งครับ '),
    finish('จบบทครับ วันนี้เราฝึกบอกชั่วโมงตรง ชั่วโมงครึ่ง และถามเวลาแล้ว'),
  ],
  fnd_v7_days_and_simple_plans: [
    task('วันนี้เราจะบอกวันและเวลาของคลาสครับ class แปลว่าคลาสเรียน ใช้ on กับวัน “The class is on Monday.” แปลว่าคลาสอยู่วันจันทร์ ลองพูดตามครับ', 'The class is on Monday.', [], '', false, SHORT),
    choiceTask('คราวนี้คลาสอยู่วันพุธครับ ลองเปลี่ยนวัน', 'The class is on Wednesday.', 'The class is on ...', [
      { emoji: '1️⃣', label: 'Monday', speak: 'The class is on Monday.' },
      { emoji: '3️⃣', label: 'Wednesday', speak: 'The class is on Wednesday.' },
    ], recap('The class is on Wednesday.', 'คลาสอยู่วันพุธ'), false, 'วันพุธใช้ Wednesday แล้วพูดว่า The class is on Wednesday. ครับ'),
    task('บอกเวลาใช้ at ครับ “The class is at seven.” แปลว่าคลาสเริ่มตอนเจ็ดโมง ลองพูดตามครับ', 'The class is at seven.', [], '', false, SHORT),
    choiceTask('คลาสเริ่มตอนแปดโมงครับ ลองบอกเวลา', 'The class is at eight.', 'The class is at ...', [
      { emoji: '🕖', label: 'seven', speak: 'The class is at seven.' },
      { emoji: '🕗', label: 'eight', speak: 'The class is at eight.' },
    ], recap('The class is at eight.', 'คลาสเริ่มตอนแปดโมง'), false, 'แปดโมงใช้ eight แล้วพูดว่า The class is at eight. ครับ'),
    choiceTask('ถ้าจะบอกว่าคลาสอยู่วันจันทร์ ต้องใช้ on หรือ at ครับ?', 'The class is on Monday.', 'The class is ... Monday.', [
      { emoji: '📅', label: 'on', speak: 'The class is on Monday.' },
      { emoji: '⏰', label: 'at', speak: 'The class is at Monday.' },
    ], recap('The class is on Monday.', 'คลาสอยู่วันจันทร์'), false, 'วันใช้ on แล้วพูดว่า The class is on Monday. ครับ'),
    choiceTask('ลองเลือกวันให้คลาสสมมติของคุณครับ', 'The class is on Monday.', 'The class is on ...', [
      { emoji: '1️⃣', label: 'Monday', speak: 'The class is on Monday.', meaningTh: 'คลาสอยู่วันจันทร์' },
      { emoji: '2️⃣', label: 'Tuesday', speak: 'The class is on Tuesday.', meaningTh: 'คลาสอยู่วันอังคาร' },
      { emoji: '3️⃣', label: 'Wednesday', speak: 'The class is on Wednesday.', meaningTh: 'คลาสอยู่วันพุธ' },
      { emoji: '4️⃣', label: 'Thursday', speak: 'The class is on Thursday.', meaningTh: 'คลาสอยู่วันพฤหัสบดี' },
    ], undefined, true, 'เลือกวันแล้วพูดว่า The class is on… ครับ'),
    finish('จบบทครับ วันนี้ใช้ on บอกวัน และ at บอกเวลาแล้ว'),
  ],
  fnd_v7_prices_and_paying: [
    task('วันนี้เราจะลองซื้อตั๋วครับ 🎫 ticket คือตั๋ว “One ticket, please.” แปลว่าขอตั๋วหนึ่งใบครับ ลองพูดตาม', 'One ticket, please.', [], '', false, SHORT),
    task('ถามราคาด้วย “How much is it?” แปลว่าราคาเท่าไร ลองพูดตามครับ', 'How much is it?', [], '', false, SHORT),
    task('baht คือบาทครับ “It is forty baht.” แปลว่าราคาสี่สิบบาท ลองพูดตามครับ', 'It is forty baht.', [], '', false, SHORT),
    choiceTask('ป้ายราคาใหม่คือ 30 บาทครับ ลองบอกราคา', 'It is thirty baht.', 'It is ... baht.', [
      { emoji: '3️⃣0️⃣', label: 'thirty', speak: 'It is thirty baht.' },
      { emoji: '4️⃣0️⃣', label: 'forty', speak: 'It is forty baht.' },
    ], recap('It is thirty baht.', 'ราคาสามสิบบาท'), false, '30 ใช้ thirty แล้วพูดว่า It is thirty baht. ครับ'),
    task('ตอนยื่นเงินให้อีกฝ่าย พูดว่า “Here you are.” หมายถึงนี่ครับ ใช้ตอนส่งของให้ ลองพูดตามครับ', 'Here you are.', [], '', false, SHORT),
    task('ลองซื้อจริงในสถานการณ์สมมติครับ คุณต้องการตั๋วหนึ่งใบ เริ่มขอกับพนักงานได้เลย', 'One ticket, please.', [], '', false, recap('One ticket, please.', 'ขอตั๋วหนึ่งใบครับ')),
    task('พนักงานหยิบตั๋วให้ดูแล้ว แต่ยังไม่บอกราคาครับ ลองถามราคา', 'How much is it?', [], '', false, recap('How much is it?', 'ราคาเท่าไร')),
    task('พนักงานตอบว่า “It is forty baht.” คุณเตรียมเงินพอดีแล้วครับ ตอนยื่นเงินจะพูดว่าอะไร?', 'Here you are.', [], '', false, recap('Here you are.', 'นี่ครับ ใช้ตอนยื่นเงินให้พนักงาน')),
    finish('พนักงานรับเงินและส่งตั๋วให้ พร้อมพูด Thank you. จบบทครับ วันนี้ได้ฝึกขอตั๋ว ถามราคา และยื่นเงินแล้ว'),
  ],
  fnd_v7_i_like_i_dont_like: [
    task('วันนี้เราจะบอกสิ่งที่ชอบและไม่ชอบครับ “I like coffee.” แปลว่าฉันชอบกาแฟ ลองพูดตามครับ', 'I like coffee.', [], '', false, SHORT),
    choiceTask('สมมติว่าคุณชอบชาแทนกาแฟครับ ลองเปลี่ยนคำท้าย', 'I like tea.', 'I like ...', [
      { emoji: '🍵', label: 'tea', speak: 'I like tea.' },
      { emoji: '☕', label: 'coffee', speak: 'I like coffee.' },
    ], recap('I like tea.', 'ฉันชอบชา'), false, 'ชาใช้ tea แล้วพูดว่า I like tea. ครับ'),
    task('ถ้าไม่ชอบ ใช้ don’t like ครับ “I don’t like tea.” แปลว่าฉันไม่ชอบชา ลองพูดตามครับ', "I don't like tea.", [], '', false, SHORT),
    choiceTask('สมมติว่าคุณไม่ชอบกาแฟครับ ลองบอกเอง', "I don't like coffee.", "I don't like ...", [
      { emoji: '🍵', label: 'tea', speak: "I don't like tea." },
      { emoji: '☕', label: 'coffee', speak: "I don't like coffee." },
    ], recap("I don't like coffee.", 'ฉันไม่ชอบกาแฟ'), false, 'กาแฟใช้ coffee แล้วพูดว่า I don’t like coffee. ครับ'),
    choiceTask('rice แปลว่าข้าวครับ 🍚 สมมติว่าคุณชอบข้าว ลองบอกด้วย I like…', 'I like rice.', 'I like ...', [
      { emoji: '🍚', label: 'rice', speak: 'I like rice.' },
      { emoji: '🍵', label: 'tea', speak: 'I like tea.' },
    ], recap('I like rice.', 'ฉันชอบข้าว'), false, 'ข้าวใช้ rice แล้วพูดว่า I like rice. ครับ'),
    choiceTask('คราวนี้พูดเรื่องชาตามความชอบของคุณครับ ชอบหรือไม่ชอบก็ได้', 'I like tea.', 'I ... tea.', [
      { emoji: '🙂', label: 'like', speak: 'I like tea.', meaningTh: 'ฉันชอบชา' },
      { emoji: '🙅', label: "don't like", speak: "I don't like tea.", meaningTh: 'ฉันไม่ชอบชา' },
    ], undefined, true, 'เลือก like หรือ don’t like แล้วพูดประโยคเต็มครับ'),
    finish('จบบทครับ วันนี้เราฝึกบอกทั้งสิ่งที่ชอบและไม่ชอบแล้ว'),
  ],
  fnd_v7_do_you_like_it: [
    task('วันนี้เราจะถามความชอบของอีกฝ่ายครับ “Do you like tea?” แปลว่าคุณชอบชาไหม ลองถามครูครับ', 'Do you like tea?', [], '', false, SHORT + 'Yes, I do. ชอบครับ '),
    choiceTask('คราวนี้ลองถามครูว่าชอบกาแฟไหมครับ', 'Do you like coffee?', 'Do you like ...?', [
      { emoji: '🍵', label: 'tea', speak: 'Do you like tea?' },
      { emoji: '☕', label: 'coffee', speak: 'Do you like coffee?' },
    ], recap('Do you like coffee?', 'คุณชอบกาแฟไหม') + 'No, I don’t. ไม่ชอบครับ ', false, 'กาแฟใช้ coffee แล้วถามว่า Do you like coffee? ครับ'),
    task('ถ้าชอบ ตอบสั้น ๆ ว่า “Yes, I do.” หมายถึงชอบครับ สมมติว่าคุณชอบชา ลองตอบนะครับ “Do you like tea?”', 'Yes, I do.', [], '', false, SHORT),
    task('ถ้าไม่ชอบ ตอบว่า “No, I don’t.” หมายถึงไม่ชอบครับ รอบนี้สมมติว่าคุณไม่ชอบกาแฟ “Do you like coffee?”', "No, I don't.", [], '', false, SHORT),
    choiceTask('คราวนี้ตอบตามตัวเองได้เลยครับ “Do you like tea?”', 'Yes, I do.', '', [
      { emoji: '🙂', label: 'Yes', speak: 'Yes, I do.', recapText: 'Yes, I do. ในคำถามนี้หมายถึง “ฉันชอบชา” ครับ ' },
      { emoji: '🙅', label: 'No', speak: "No, I don't.", recapText: 'No, I don’t. ในคำถามนี้หมายถึง “ฉันไม่ชอบชา” ครับ ' },
    ], undefined, true, 'ตอบ Yes, I do. หรือ No, I don’t. ครับ'),
    finish('จบบทครับ เราฝึกถามความชอบและตอบได้ทั้งชอบกับไม่ชอบแล้ว'),
  ],
  fnd_v7_want_need_and_please: [
    task('วันนี้เราจะบอกสิ่งที่อยากได้และขอสิ่งที่จำเป็นครับ want ใช้บอกว่าอยากได้ “I want water.” แปลว่าฉันอยากได้น้ำ ลองพูดตามครับ', 'I want water.', [], '', false, SHORT),
    choiceTask('สมมติว่าคุณอยากได้ชาครับ ลองเปลี่ยนคำท้าย', 'I want tea.', 'I want ...', [
      { emoji: '💧', label: 'water', speak: 'I want water.' },
      { emoji: '🍵', label: 'tea', speak: 'I want tea.' },
    ], recap('I want tea.', 'ฉันอยากได้ชา'), false, 'ชาใช้ tea แล้วพูดว่า I want tea. ครับ'),
    task('ถ้าต้องการความช่วยเหลือ ใช้ need ครับ help คือความช่วยเหลือ “I need help.” แปลว่าฉันต้องการความช่วยเหลือ ลองพูดตามครับ', 'I need help.', [], '', false, SHORT),
    choiceTask('สมมติว่าคุณเปิดประตูไม่ได้และต้องการให้คนช่วยครับ จะบอกเขาว่าอะไร?', 'I need help.', 'I need ...', [
      { emoji: '🆘', label: 'help', speak: 'I need help.' },
      { emoji: '💧', label: 'water', speak: 'I need water.' },
    ], recap('I need help.', 'ฉันต้องการความช่วยเหลือ'), false, 'ต้องการคนช่วยใช้ help แล้วพูดว่า I need help. ครับ'),
    task('เมื่อสั่งของกับพนักงาน ใช้คำขอสุภาพได้ครับ “Tea, please.” แปลว่าขอชาครับ ลองพูดตาม', 'Tea, please.', [], '', false, SHORT),
    choiceTask('เลือกเครื่องดื่มแล้วขออย่างสุภาพครับ', 'Tea, please.', '..., please.', [
      { emoji: '💧', label: 'water', speak: 'Water, please.', meaningTh: 'ขอน้ำครับ' },
      { emoji: '🍵', label: 'tea', speak: 'Tea, please.', meaningTh: 'ขอชาครับ' },
      { emoji: '☕', label: 'coffee', speak: 'Coffee, please.', meaningTh: 'ขอกาแฟครับ' },
    ], undefined, true, 'เลือกเครื่องดื่มแล้วพูดว่า …, please. ครับ'),
    finish('จบบทครับ เราฝึก want, need และการขอของด้วย please แล้ว'),
  ],
  fnd_v7_i_can: [
    task('วันนี้เราจะบอกสิ่งที่ทำได้ครับ ใช้ can ตามด้วยกิจกรรม “I can swim.” แปลว่าฉันว่ายน้ำเป็น ลองพูดตามครับ', 'I can swim.', [], '', false, SHORT),
    choiceTask('สมมติว่าคุณอ่านได้ครับ ลองเปลี่ยนกิจกรรม', 'I can read.', 'I can ...', [
      { emoji: '📖', label: 'read', speak: 'I can read.' },
      { emoji: '🏊', label: 'swim', speak: 'I can swim.' },
    ], recap('I can read.', 'ฉันอ่านได้'), false, 'อ่านใช้ read แล้วพูดว่า I can read. ครับ'),
    choiceTask('สมมติว่าคุณทำอาหารเป็นครับ 🍳 ลองบอกด้วย I can…', 'I can cook.', 'I can ...', [
      { emoji: '🍳', label: 'cook', speak: 'I can cook.' },
      { emoji: '📖', label: 'read', speak: 'I can read.' },
    ], recap('I can cook.', 'ฉันทำอาหารเป็น'), false, 'ทำอาหารใช้ cook แล้วพูดว่า I can cook. ครับ'),
    choiceTask('เลือกสิ่งที่ทำได้หนึ่งอย่างครับ จะเป็นตัวคุณหรือคนสมมติก็ได้', 'I can swim.', 'I can ...', [
      { emoji: '🏊', label: 'swim', speak: 'I can swim.', meaningTh: 'ฉันว่ายน้ำเป็น' },
      { emoji: '📖', label: 'read', speak: 'I can read.', meaningTh: 'ฉันอ่านได้' },
      { emoji: '🍳', label: 'cook', speak: 'I can cook.', meaningTh: 'ฉันทำอาหารเป็น' },
    ], undefined, true, 'เลือกกิจกรรมแล้วพูดว่า I can… ครับ'),
    finish('จบบทครับ วันนี้นำคำกริยาที่รู้มาใช้กับ I can… แล้ว'),
  ],
  fnd_v7_cant_and_can_you: [
    task('วันนี้เราจะบอกสิ่งที่ทำไม่ได้และถามความสามารถครับ “I can’t swim.” แปลว่าฉันว่ายน้ำไม่เป็น ลองพูดตามครับ', "I can't swim.", [], '', false, SHORT),
    choiceTask('สมมติว่าคุณทำอาหารไม่เป็นครับ ลองเปลี่ยนกิจกรรม', "I can't cook.", "I can't ...", [
      { emoji: '🍳', label: 'cook', speak: "I can't cook." },
      { emoji: '🏊', label: 'swim', speak: "I can't swim." },
    ], recap("I can't cook.", 'ฉันทำอาหารไม่เป็น'), false, 'ทำอาหารไม่เป็นใช้ cook แล้วพูดว่า I can’t cook. ครับ'),
    task('ถ้าถามอีกฝ่าย ใช้ Can you…? ครับ “Can you swim?” แปลว่าคุณว่ายน้ำเป็นไหม ลองถามครูครับ', 'Can you swim?', [], '', false, SHORT + 'Yes, I can. ว่ายน้ำเป็นครับ '),
    choiceTask('ลองถามครูว่าทำอาหารเป็นไหมครับ', 'Can you cook?', 'Can you ...?', [
      { emoji: '🍳', label: 'cook', speak: 'Can you cook?' },
      { emoji: '🏊', label: 'swim', speak: 'Can you swim?' },
    ], recap('Can you cook?', 'คุณทำอาหารเป็นไหม') + 'No, I can’t. ทำอาหารไม่เป็นครับ ', false, 'ทำอาหารใช้ cook แล้วถามว่า Can you cook? ครับ'),
    task('ถ้าทำได้ ตอบว่า “Yes, I can.” หมายถึงทำได้ครับ สมมติว่าคุณว่ายน้ำเป็น “Can you swim?”', 'Yes, I can.', [], '', false, SHORT),
    task('ถ้าทำไม่ได้ ตอบว่า “No, I can’t.” หมายถึงทำไม่ได้ครับ สมมติว่าคุณทำอาหารไม่เป็น “Can you cook?”', "No, I can't.", [], '', false, SHORT),
    choiceTask('คราวนี้ตอบตามตัวเองครับ “Can you cook?”', 'Yes, I can.', '', [
      { emoji: '🙂', label: 'Yes', speak: 'Yes, I can.', recapText: 'Yes, I can. ในคำถามนี้หมายถึง “ฉันทำอาหารเป็น” ครับ ' },
      { emoji: '🙅', label: 'No', speak: "No, I can't.", recapText: 'No, I can’t. ในคำถามนี้หมายถึง “ฉันทำอาหารไม่เป็น” ครับ ' },
    ], undefined, true, 'ตอบ Yes, I can. หรือ No, I can’t. ครับ'),
    finish('จบบทครับ วันนี้ได้ฝึกบอกว่าทำไม่ได้ ถาม และตอบเรื่องความสามารถแล้ว'),
  ],
  fnd_v7_my_day: [
    task('วันนี้เราจะเล่ากิจวัตรพร้อมเวลาครับ “I wake up at seven.” แปลว่าฉันตื่นตอนเจ็ดโมง ลองพูดตามครับ', 'I wake up at seven.', [], '', false, SHORT),
    choiceTask('สมมติว่าคุณตื่นตอนแปดโมงครับ ลองเปลี่ยนเวลา', 'I wake up at eight.', 'I wake up at ...', [
      { emoji: '🕖', label: 'seven', speak: 'I wake up at seven.' },
      { emoji: '🕗', label: 'eight', speak: 'I wake up at eight.' },
    ], recap('I wake up at eight.', 'ฉันตื่นตอนแปดโมง'), false, 'แปดโมงใช้ eight แล้วพูดว่า I wake up at eight. ครับ'),
    task('บอกวันได้ด้วยครับ “I work on Monday.” แปลว่าฉันทำงานวันจันทร์ ลองพูดตามครับ', 'I work on Monday.', [], '', false, SHORT),
    choiceTask('สมมติว่าคุณทำงานวันศุกร์ครับ ลองเปลี่ยนวัน', 'I work on Friday.', 'I work on ...', [
      { emoji: '1️⃣', label: 'Monday', speak: 'I work on Monday.' },
      { emoji: '5️⃣', label: 'Friday', speak: 'I work on Friday.' },
    ], recap('I work on Friday.', 'ฉันทำงานวันศุกร์'), false, 'วันศุกร์ใช้ Friday แล้วพูดว่า I work on Friday. ครับ'),
    task('every day แปลว่าทุกวันครับ “I read every day.” แปลว่าฉันอ่านทุกวัน ลองพูดตามครับ', 'I read every day.', [], '', false, SHORT),
    choiceTask('เลือกกิจกรรมที่ทำทุกวันหนึ่งอย่างครับ ใช้ข้อมูลจริงหรือสมมติได้', 'I read every day.', 'I ... every day.', [
      { emoji: '📖', label: 'read', speak: 'I read every day.', meaningTh: 'ฉันอ่านทุกวัน' },
      { emoji: '🍳', label: 'cook', speak: 'I cook every day.', meaningTh: 'ฉันทำอาหารทุกวัน' },
      { emoji: '💼', label: 'work', speak: 'I work every day.', meaningTh: 'ฉันทำงานทุกวัน' },
    ], undefined, true, 'เลือกกิจกรรมแล้วพูดว่า I … every day. ครับ'),
    finish('จบบทครับ วันนี้ฝึกเล่ากิจวัตรพร้อมเวลา วัน และคำว่าทุกวันแล้ว'),
  ],
  fnd_v7_her_day_his_day: [
    task('ครั้งก่อนเราเล่าว่าตัวเองทำอะไร วันนี้จะเล่าเรื่องของคนอื่นครับ “I work.” แปลว่าฉันทำงาน เมื่อพูดถึงเธอเป็น “She works.” แปลว่าเธอทำงาน สังเกตว่า work มี s เพิ่มมาครับ ลองพูด She works.', 'She works.', [], '', false, SHORT),
    choiceTask('ลองบอกว่าเธอทำงานครับ ต้องเลือกคำกริยารูปไหน?', 'She works.', 'She ...', [
      { emoji: '💼', label: 'work', speak: 'She work.' },
      { emoji: '💼', label: 'works', speak: 'She works.' },
    ], recap('She works.', 'เธอทำงาน'), false, 'พูดถึง she ใช้ works แล้วพูดว่า She works. ครับ'),
    choiceTask('กลับมาพูดถึงตัวเองว่าฉันทำงานครับ ควรเลือกคำไหน?', 'I work.', 'I ...', [
      { emoji: '💼', label: 'work', speak: 'I work.' },
      { emoji: '💼', label: 'works', speak: 'I works.' },
    ], recap('I work.', 'ฉันทำงาน'), false, 'พูดถึงตัวเองใช้ work แล้วพูดว่า I work. ครับ'),
    task('he ก็ใช้กริยาที่เติม s ครับ “He eats.” แปลว่าเขากิน ลองพูดตามครับ', 'He eats.', [], '', false, SHORT),
    choiceTask('ลองบอกว่าเขากินครับ เลือกรูปกริยาให้ตรง', 'He eats.', 'He ...', [
      { emoji: '🍽️', label: 'eat', speak: 'He eat.' },
      { emoji: '🍽️', label: 'eats', speak: 'He eats.' },
    ], recap('He eats.', 'เขากิน'), false, 'พูดถึง he ใช้ eats แล้วพูดว่า He eats. ครับ'),
    choiceTask('เติมเวลาแบบที่เรียนแล้วได้ครับ ถ้าเขากินตอนเจ็ดโมง จะพูดอย่างไร?', 'He eats at seven.', 'He eats at ...', [
      { emoji: '🕖', label: 'seven', speak: 'He eats at seven.' },
      { emoji: '🕗', label: 'eight', speak: 'He eats at eight.' },
    ], recap('He eats at seven.', 'เขากินตอนเจ็ดโมง'), false, 'เจ็ดโมงใช้ seven แล้วพูดว่า He eats at seven. ครับ'),
    finish('จบบทครับ เราฝึกเปลี่ยน work เป็น works และ eat เป็น eats เมื่อพูดถึง he หรือ she'),
  ],
  fnd_v7_do_does_every_day: [
    task('“คุณทำงานทุกวัน” เป็นการบอกข้อมูลครับ ถ้าเรายังไม่รู้และอยากถามว่า “คุณทำงานทุกวันไหม” ใช้ Do you…? เป็น “Do you work every day?” ลองถามครูครับ', 'Do you work every day?', [], '', false, SHORT + 'Yes, I do. ทำงานทุกวันครับ '),
    task('สมมติว่า Ben เป็นผู้ชายและทำงานทุกวันครับ ถ้าถามครูเกี่ยวกับเขา ใช้ “Does he work every day?” แปลว่าเขาทำงานทุกวันไหม หลัง does ใช้ work ไม่เติม s ลองถามครับ', 'Does he work every day?', [], '', false, SHORT + 'Yes, he does. เขาทำงานทุกวันครับ '),
    choiceTask('คราวนี้คุณหันไปถาม Ben โดยตรงว่าคุณทำงานทุกวันไหมครับ ใช้คำขึ้นต้นไหน?', 'Do you work every day?', '... you work every day?', [
      { emoji: '🗣️', label: 'Do', speak: 'Do you work every day?' },
      { emoji: '👉', label: 'Does', speak: 'Does you work every day?' },
    ], recap('Do you work every day?', 'คุณทำงานทุกวันไหม') + 'Yes, I do. ', false, 'ถามคนตรงหน้าใช้ Do แล้วพูดว่า Do you work every day? ครับ'),
    choiceTask('คุณหันกลับมาถามครูเกี่ยวกับ Ben ว่าเขาทำงานทุกวันไหมครับ', 'Does he work every day?', '... he work every day?', [
      { emoji: '🗣️', label: 'Do', speak: 'Do he work every day?' },
      { emoji: '👉', label: 'Does', speak: 'Does he work every day?' },
    ], recap('Does he work every day?', 'เขาทำงานทุกวันไหม') + 'Yes, he does. ', false, 'ถามถึงผู้ชายอีกคนใช้ Does แล้วพูดว่า Does he work every day? ครับ'),
    choiceTask('หลัง Does ใช้กริยารูปเดิมครับ ลองเลือกให้ประโยคถามถึง Ben ถูกต้อง', 'Does he work every day?', 'Does he ... every day?', [
      { emoji: '💼', label: 'work', speak: 'Does he work every day?' },
      { emoji: '💼', label: 'works', speak: 'Does he works every day?' },
    ], recap('Does he work every day?', 'เขาทำงานทุกวันไหม') + 'Yes, he does. ', false, 'หลัง Does ใช้ work ไม่เติม s ครับ'),
    choiceTask('she ก็ใช้ Does ครับ สมมติว่า Anna ทำอาหารทุกวัน ลองถามครูเพื่อยืนยัน', 'Does she cook every day?', '... she cook every day?', [
      { emoji: '🗣️', label: 'Do', speak: 'Do she cook every day?' },
      { emoji: '👉', label: 'Does', speak: 'Does she cook every day?' },
    ], recap('Does she cook every day?', 'เธอทำอาหารทุกวันไหม') + 'Yes, she does. ', false, 'ถามถึงผู้หญิงใช้ Does แล้วพูดว่า Does she cook every day? ครับ'),
    finish('จบบทครับ วันนี้ฝึก Do you…? และ Does he/she…? โดยใช้กริยารูปเดิมหลัง Does'),
  ],
  fnd_v7_happening_now: [
    task('ครั้งก่อนเราเล่าว่าทำอะไรเป็นประจำครับ บทนี้เราจะบอกว่าตอนนี้กำลังทำอะไรอยู่ สมมติว่าคุณกำลังอ่านหนังสือตอนนี้ 📖 “I am reading.” แปลว่าฉันกำลังอ่าน ลองพูดตามครับ', 'I am reading.', [], '', false, SHORT),
    task('ถ้าพูดถึงเธอ เปลี่ยนเป็น “She is reading.” แปลว่าเธอกำลังอ่านครับ ใช้ is กับ she ลองพูดตาม', 'She is reading.', [], '', false, SHORT),
    choiceTask('Anna กำลังอ่านอยู่ตอนนี้ครับ ลองเลือกคำให้ตรงกับ she', 'She is reading.', 'She ... reading.', [
      { emoji: '👤', label: 'am', speak: 'She am reading.' },
      { emoji: '👉', label: 'is', speak: 'She is reading.' },
    ], recap('She is reading.', 'เธอกำลังอ่าน'), false, 'ใช้ is กับ she แล้วพูดว่า She is reading. ครับ'),
    task('ถ้าเป็นคนหลายคนใช้ are ครับ “They are reading.” แปลว่าพวกเขากำลังอ่าน ลองพูดตามครับ', 'They are reading.', [], '', false, SHORT),
    choiceTask('คนกลุ่มนั้นกำลังอ่านครับ ลองเลือกคำให้ตรงกับ they', 'They are reading.', 'They ... reading.', [
      { emoji: '👉', label: 'is', speak: 'They is reading.' },
      { emoji: '👥', label: 'are', speak: 'They are reading.' },
    ], recap('They are reading.', 'พวกเขากำลังอ่าน'), false, 'ใช้ are กับ they แล้วพูดว่า They are reading. ครับ'),
    task('cook เปลี่ยนเป็น cooking เมื่อบอกว่ากำลังทำครับ “I am cooking.” แปลว่าฉันกำลังทำอาหาร ลองพูดตามครับ', 'I am cooking.', [], '', false, SHORT),
    choiceTask('เลือกสิ่งที่ตัวละครของคุณกำลังทำตอนนี้ครับ', 'I am reading.', 'I am ...', [
      { emoji: '📖', label: 'reading', speak: 'I am reading.', meaningTh: 'ฉันกำลังอ่าน' },
      { emoji: '🍳', label: 'cooking', speak: 'I am cooking.', meaningTh: 'ฉันกำลังทำอาหาร' },
    ], undefined, true, 'เลือกกิจกรรมแล้วพูดว่า I am… ครับ'),
    finish('จบบทครับ วันนี้ฝึกบอกสิ่งที่กำลังทำด้วย am, is, are และรูปกริยาที่ลงท้าย ing'),
  ],
  fnd_v7_are_they_working: [
    task('วันนี้เราจะถามว่าคนอื่นกำลังทำอะไร และบอกเมื่อเขาไม่ได้ทำสิ่งนั้นครับ work คือทำงาน “They are working.” คือพวกเขากำลังทำงาน ถ้าถาม สลับเป็น “Are they working?” แปลว่าพวกเขากำลังทำงานไหม ลองพูดคำถามครับ', 'Are they working?', [], '', false, SHORT),
    choiceTask('คุณอยากถามถึงคนหลายคนว่ากำลังทำงานไหมครับ ควรขึ้นต้นด้วยอะไร?', 'Are they working?', '... they working?', [
      { emoji: '👉', label: 'Is', speak: 'Is they working?' },
      { emoji: '👥', label: 'Are', speak: 'Are they working?' },
    ], recap('Are they working?', 'พวกเขากำลังทำงานไหม'), false, 'ถาม they ใช้ Are แล้วพูดว่า Are they working? ครับ'),
    task('ถ้าพวกเขาไม่ได้กำลังทำงาน เติม not ครับ “They are not working.” แปลว่าพวกเขาไม่ได้กำลังทำงาน ลองพูดตามครับ', 'They are not working.', [], '', false, SHORT),
    task('ถ้าถามถึง Anna คนเดียว ใช้ is กับ she ครับ “Is she working?” แปลว่าเธอกำลังทำงานไหม ลองพูดตามครับ', 'Is she working?', [], '', false, SHORT),
    choiceTask('ลองถามถึง Anna อีกครั้งครับ เลือกคำขึ้นต้นให้ตรงกับ she', 'Is she working?', '... she working?', [
      { emoji: '👉', label: 'Is', speak: 'Is she working?' },
      { emoji: '👥', label: 'Are', speak: 'Are she working?' },
    ], recap('Is she working?', 'เธอกำลังทำงานไหม'), false, 'ถาม she ใช้ Is แล้วพูดว่า Is she working? ครับ'),
    choiceTask('ตอนนี้ Anna ไม่ได้กำลังทำงานครับ ใช้ She is not… เหมือนการเติม not ที่เรียนแล้ว ลองพูดประโยคเต็ม', 'She is not working.', 'She is not ...', [
      { emoji: '💼', label: 'working', speak: 'She is not working.' },
      { emoji: '📖', label: 'reading', speak: 'She is not reading.' },
    ], recap('She is not working.', 'เธอไม่ได้กำลังทำงาน'), false, 'ไม่ได้กำลังทำงานใช้ working แล้วพูดว่า She is not working. ครับ'),
    finish('จบบทครับ วันนี้ฝึกถามด้วย Is/Are และเติม not เพื่อบอกว่าไม่ได้กำลังทำ'),
  ],
  fnd_v7_what_or_who: [
    task('วันนี้เราจะถามว่าสิ่งนี้คืออะไรหรือคนนี้คือใครครับ 📦 ใช้ what กับสิ่งของ “What is this?” แปลว่านี่คืออะไร ลองถามครับ', 'What is this?', [], '', false, SHORT + 'It is a book. มันคือหนังสือครับ '),
    choiceTask('สมมติว่ามีของอยู่ตรงหน้าและคุณไม่รู้ว่าคืออะไรครับ ควรเริ่มคำถามด้วยคำไหน?', 'What is this?', '... is this?', [
      { emoji: '📦', label: 'What', speak: 'What is this?' },
      { emoji: '👤', label: 'Who', speak: 'Who is this?' },
    ], recap('What is this?', 'นี่คืออะไร') + 'It is a bag. มันคือกระเป๋าครับ ', false, 'สิ่งของใช้ What แล้วพูดว่า What is this? ครับ'),
    task('ถ้าอยากรู้ว่าคนนี้คือใคร ใช้ who ครับ “Who is this?” แปลว่านี่คือใคร ลองถามครับ', 'Who is this?', [], '', false, SHORT + 'This is Max. นี่คือ Max ครับ '),
    choiceTask('มีคนอยู่ข้างครูและคุณอยากรู้ว่าเป็นใครครับ ควรใช้คำถามไหน?', 'Who is this?', '... is this?', [
      { emoji: '📦', label: 'What', speak: 'What is this?' },
      { emoji: '👤', label: 'Who', speak: 'Who is this?' },
    ], recap('Who is this?', 'นี่คือใคร') + 'This is Anna. นี่คือ Anna ครับ ', false, 'คนใช้ Who แล้วพูดว่า Who is this? ครับ'),
    task('กลับมาที่สิ่งของครับ คุณไม่รู้ว่าของตรงหน้าคืออะไร ลองถามเอง', 'What is this?', [], '', false, recap('What is this?', 'นี่คืออะไร') + 'It is a phone. มันคือโทรศัพท์ครับ '),
    finish('จบบทครับ what ใช้ถามสิ่งของ ส่วน who ใช้ถามคน'),
  ],
  fnd_v7_where_when_how_much_and_how_many: [
    task('ก่อนถาม ลองดูว่าเราอยากรู้ข้อมูลอะไรครับ ถ้ารู้ว่ามีคลาส แต่ยังไม่รู้สถานที่ ใช้ where “Where is the class?” แปลว่าคลาสอยู่ที่ไหน ลองถามครับ', 'Where is the class?', [], '', false, SHORT + 'คลาสอยู่ห้องข้าง ๆ ครับ '),
    task('ตอนนี้รู้สถานที่แล้ว แต่ยังไม่รู้ว่าคลาสมีเมื่อไรครับ ข้อมูลที่ขาดคือเวลา จึงใช้ when “When is the class?” แปลว่าคลาสมีเมื่อไร ลองถามครับ', 'When is the class?', [], '', false, SHORT + 'On Monday. วันจันทร์ครับ '),
    choiceTask('คุณรู้วันแล้ว แต่ยังไม่รู้สถานที่ครับ ควรถามด้วยคำไหน?', 'Where is the class?', '... is the class?', [
      { emoji: '📍', label: 'Where', speak: 'Where is the class?' },
      { emoji: '📅', label: 'When', speak: 'When is the class?' },
    ], recap('Where is the class?', 'คลาสอยู่ที่ไหน') + 'ห้องข้าง ๆ ครับ ', false, 'ยังไม่รู้สถานที่ ใช้ Where แล้วพูดว่า Where is the class? ครับ'),
    choiceTask('คราวนี้รู้ห้องแล้ว แต่ยังไม่รู้วันครับ ลองเลือกคำถาม', 'When is the class?', '... is the class?', [
      { emoji: '📍', label: 'Where', speak: 'Where is the class?' },
      { emoji: '📅', label: 'When', speak: 'When is the class?' },
    ], recap('When is the class?', 'คลาสมีเมื่อไร') + 'On Friday. วันศุกร์ครับ ', false, 'ยังไม่รู้วัน ใช้ When แล้วพูดว่า When is the class? ครับ'),
    task('เปลี่ยนมาที่ร้านครับ รู้แล้วว่าอยากซื้ออะไร แต่ยังไม่รู้ราคา ใช้ “How much is it?” แปลว่าราคาเท่าไร ลองถามครับ', 'How much is it?', [], '', false, SHORT + 'Thirty baht. สามสิบบาทครับ '),
    task('ถ้ารู้ราคาแล้ว แต่อยากรู้ว่าต้องเตรียมหนังสือกี่เล่ม เรากำลังถามจำนวนครับ ใช้ how many “How many books?” แปลว่าหนังสือกี่เล่ม ลองถามครับ', 'How many books?', [], '', false, SHORT + 'Two books. สองเล่มครับ '),
    choiceTask('คุณอยากรู้ราคาของกระเป๋าครับ ต้องเลือกคำถามไหน?', 'How much is it?', '', [
      { emoji: '🏷️', label: 'How much', speak: 'How much is it?' },
      { emoji: '🔢', label: 'How many', speak: 'How many bags?' },
    ], recap('How much is it?', 'ราคาเท่าไร') + 'Forty baht. สี่สิบบาทครับ ', false, 'ถามราคาใช้ How much แล้วพูดว่า How much is it? ครับ'),
    choiceTask('รู้ราคาแล้ว แต่ไม่รู้ว่าต้องเตรียมหนังสือกี่เล่มครับ ลองถามจำนวน', 'How many books?', '... books?', [
      { emoji: '🏷️', label: 'How much', speak: 'How much books?' },
      { emoji: '🔢', label: 'How many', speak: 'How many books?' },
    ], recap('How many books?', 'หนังสือกี่เล่ม') + 'Three books. สามเล่มครับ ', false, 'ถามจำนวนใช้ How many แล้วพูดว่า How many books? ครับ'),
    finish('จบบทครับ where ถามสถานที่ when ถามเวลา how much ถามราคา และ how many ถามจำนวน'),
  ],
  fnd_v7_there_is_there_are: [
    task('ครั้งก่อนเราใช้ have บอกว่าใครมีอะไรครับ วันนี้เราจะบอกว่าในสถานที่หนึ่งมีอะไรอยู่ เช่นในห้องมีเก้าอี้หนึ่งตัว 🪑 ใช้ “There is a chair.” แปลว่ามีเก้าอี้หนึ่งตัว ลองพูดตามครับ', 'There is a chair.', [], '', false, SHORT),
    task('ถ้ามีหลายตัว ใช้ There are ครับ “There are two chairs.” แปลว่ามีเก้าอี้สองตัว ลองพูดตามครับ', 'There are two chairs.', [], '', false, SHORT),
    choiceTask('ในห้องมีเก้าอี้สองตัวครับ เลือก is หรือ are', 'There are two chairs.', 'There ... two chairs.', [
      { emoji: '1️⃣', label: 'is', speak: 'There is two chairs.' },
      { emoji: '2️⃣', label: 'are', speak: 'There are two chairs.' },
    ], recap('There are two chairs.', 'มีเก้าอี้สองตัว'), false, 'หลายตัวใช้ are แล้วพูดว่า There are two chairs. ครับ'),
    choiceTask('คราวนี้มีเก้าอี้หนึ่งตัวครับ ลองเลือกให้ตรงจำนวน', 'There is a chair.', 'There ... a chair.', [
      { emoji: '1️⃣', label: 'is', speak: 'There is a chair.' },
      { emoji: '2️⃣', label: 'are', speak: 'There are a chair.' },
    ], recap('There is a chair.', 'มีเก้าอี้หนึ่งตัว'), false, 'หนึ่งตัวใช้ is แล้วพูดว่า There is a chair. ครับ'),
    choiceTask('บนโต๊ะมีหนังสือหนึ่งเล่มครับ ลองบอกว่ามีหนังสือหนึ่งเล่ม', 'There is a book.', 'There is a ...', [
      { emoji: '📖', label: 'book', speak: 'There is a book.' },
      { emoji: '🪑', label: 'chair', speak: 'There is a chair.' },
    ], recap('There is a book.', 'มีหนังสือหนึ่งเล่ม'), false, 'หนังสือใช้ book แล้วพูดว่า There is a book. ครับ'),
    finish('จบบทครับ เราฝึก There is กับหนึ่งสิ่ง และ There are กับหลายสิ่งแล้ว'),
  ],
  fnd_v7_in_on_under_next_to: [
    task('วันนี้เราจะบอกตำแหน่งของครับ หนังสืออยู่ในกระเป๋า ใช้ in “The book is in the bag.” แปลว่าหนังสืออยู่ในกระเป๋า ลองพูดตามครับ', 'The book is in the bag.', [], '', false, SHORT),
    task('ถ้าหนังสืออยู่บนโต๊ะ ใช้ on ครับ “The book is on the table.” แปลว่าหนังสืออยู่บนโต๊ะ ลองพูดตามครับ', 'The book is on the table.', [], '', false, SHORT),
    choiceTask('สมมติว่าคุณวางหนังสือไว้บนโต๊ะครับ เลือกคำบอกตำแหน่ง', 'The book is on the table.', 'The book is ... the table.', [
      { emoji: '📥', label: 'in', speak: 'The book is in the table.' },
      { emoji: '⬆️', label: 'on', speak: 'The book is on the table.' },
    ], recap('The book is on the table.', 'หนังสืออยู่บนโต๊ะ'), false, 'บนโต๊ะใช้ on แล้วพูดว่า The book is on the table. ครับ'),
    task('หนังสือตกไปอยู่ใต้โต๊ะครับ ใช้ under “The book is under the table.” แปลว่าหนังสืออยู่ใต้โต๊ะ ลองพูดตามครับ', 'The book is under the table.', [], '', false, SHORT),
    task('ถ้าหนังสือวางอยู่ข้างกระเป๋า ใช้ next to ครับ “The book is next to the bag.” แปลว่าหนังสืออยู่ข้างกระเป๋า ลองพูดตามครับ', 'The book is next to the bag.', [], '', false, SHORT),
    choiceTask('หนังสืออยู่ข้างกระเป๋าครับ ลองเลือกคำบอกตำแหน่ง', 'The book is next to the bag.', 'The book is ... the bag.', [
      { emoji: '📥', label: 'in', speak: 'The book is in the bag.' },
      { emoji: '↔️', label: 'next to', speak: 'The book is next to the bag.' },
    ], recap('The book is next to the bag.', 'หนังสืออยู่ข้างกระเป๋า'), false, 'ข้างกระเป๋าใช้ next to แล้วพูดว่า The book is next to the bag. ครับ'),
    choiceTask('คราวนี้หนังสืออยู่ใต้โต๊ะครับ ลองบอกตำแหน่ง', 'The book is under the table.', 'The book is ... the table.', [
      { emoji: '⬆️', label: 'on', speak: 'The book is on the table.' },
      { emoji: '⬇️', label: 'under', speak: 'The book is under the table.' },
    ], recap('The book is under the table.', 'หนังสืออยู่ใต้โต๊ะ'), false, 'ใต้โต๊ะใช้ under แล้วพูดว่า The book is under the table. ครับ'),
    task('เก็บหนังสือเข้าไปในกระเป๋าแล้วครับ ลองบอกตำแหน่งเอง', 'The book is in the bag.', [], '', false, recap('The book is in the bag.', 'หนังสืออยู่ในกระเป๋า')),
    finish('จบบทครับ เราฝึกบอกตำแหน่งด้วย in, on, under และ next to แล้ว'),
  ],
  fnd_v7_go_straight_turn_left: [
    task('วันนี้เราจะช่วยบอกทางสั้น ๆ ครับ ⬆️ “Go straight.” แปลว่าตรงไป ลองพูดตามครับ', 'Go straight.', [], '', false, SHORT),
    task('เมื่อจะให้เลี้ยวซ้าย ใช้ “Turn left.” แปลว่าเลี้ยวซ้ายครับ ↩️ ลองพูดตาม', 'Turn left.', [], '', false, SHORT),
    task('ถ้าเลี้ยวขวา ใช้ “Turn right.” แปลว่าเลี้ยวขวาครับ ↪️ ลองพูดตาม', 'Turn right.', [], '', false, SHORT),
    choiceTask('Max ต้องเลี้ยวขวาที่ทางแยกครับ จะบอกว่าอย่างไร?', 'Turn right.', '', [
      { emoji: '⬆️', label: 'straight', speak: 'Go straight.' },
      { emoji: '↩️', label: 'left', speak: 'Turn left.' },
      { emoji: '↪️', label: 'right', speak: 'Turn right.' },
    ], recap('Turn right.', 'เลี้ยวขวา'), false, 'เลี้ยวขวาใช้ right แล้วพูดว่า Turn right. ครับ'),
    task('ถ้าต้องการให้หยุด ใช้ “Stop.” แปลว่าหยุดครับ ✋ ลองพูดตาม', 'Stop.', [], '', false, SHORT),
    choiceTask('Max มาถึงจุดนัดพบแล้วครับ ให้เขาหยุดตรงนี้ จะพูดว่าอะไร?', 'Stop.', '', [
      { emoji: '✋', label: 'stop', speak: 'Stop.' },
      { emoji: '⬆️', label: 'straight', speak: 'Go straight.' },
    ], recap('Stop.', 'หยุด'), false, 'ถึงจุดนัดพบแล้วพูด Stop. ครับ'),
    task('เชื่อมสองขั้นด้วย then แปลว่าแล้วครับ “Go straight, then turn left.” แปลว่าตรงไปแล้วเลี้ยวซ้าย ลองพูดตามครับ', 'Go straight, then turn left.', [], '', false, SHORT),
    task('คราวนี้ต้องตรงไปแล้วเลี้ยวขวาครับ ⬆️↪️ ลองบอกสองขั้น', 'Go straight, then turn right.', [], '', false, recap('Go straight, then turn right.', 'ตรงไปแล้วเลี้ยวขวา')),
    finish('จบบทครับ วันนี้ฝึกตรงไป เลี้ยวซ้าย เลี้ยวขวา หยุด และเชื่อมเส้นทางสองขั้นแล้ว'),
  ],
  fnd_v7_where_is_it: [
    task('วันนี้เราจะถามหาสถานที่และบอกตำแหน่งครับ “Where is the café?” แปลว่าคาเฟ่อยู่ที่ไหน ลองถามครับ', 'Where is the café?', [], '', false, SHORT + 'อยู่ข้างร้านค้าครับ '),
    choiceTask('คราวนี้คุณอยากหาร้านค้าครับ ลองถาม', 'Where is the shop?', 'Where is the ...?', [
      { emoji: '☕', label: 'café', speak: 'Where is the café?' },
      { emoji: '🛍️', label: 'shop', speak: 'Where is the shop?' },
    ], recap('Where is the shop?', 'ร้านค้าอยู่ที่ไหน'), false, 'ร้านค้าใช้ shop แล้วถามว่า Where is the shop? ครับ'),
    task('ตอบตำแหน่งด้วย next to ที่เรียนแล้วได้ครับ “The café is next to the shop.” แปลว่าคาเฟ่อยู่ข้างร้านค้า ลองพูดตามครับ', 'The café is next to the shop.', [], '', false, SHORT),
    choiceTask('สมมติว่าโรงเรียนอยู่ข้างร้านค้าครับ ลองเปลี่ยนสถานที่ต้นประโยค', 'The school is next to the shop.', 'The ... is next to the shop.', [
      { emoji: '🏫', label: 'school', speak: 'The school is next to the shop.' },
      { emoji: '☕', label: 'café', speak: 'The café is next to the shop.' },
    ], recap('The school is next to the shop.', 'โรงเรียนอยู่ข้างร้านค้า'), false, 'โรงเรียนใช้ school แล้วพูดว่า The school is next to the shop. ครับ'),
    choiceTask('เลือกสถานที่ที่คุณอยากถามหาในสถานการณ์นี้ครับ', 'Where is the café?', 'Where is the ...?', [
      { emoji: '🏫', label: 'school', speak: 'Where is the school?', recapText: recap('Where is the school?', 'โรงเรียนอยู่ที่ไหน') + 'อยู่ข้างร้านค้าครับ ' },
      { emoji: '☕', label: 'café', speak: 'Where is the café?', recapText: recap('Where is the café?', 'คาเฟ่อยู่ที่ไหน') + 'อยู่ข้างร้านค้าครับ ' },
      { emoji: '🛍️', label: 'shop', speak: 'Where is the shop?', recapText: recap('Where is the shop?', 'ร้านค้าอยู่ที่ไหน') + 'อยู่ระหว่างโรงเรียนกับคาเฟ่ครับ ' },
    ], undefined, true, 'เลือกสถานที่แล้วถาม Where is the…? ครับ'),
    finish('จบบทครับ เราฝึกถามหาสถานที่และใช้ next to บอกตำแหน่งแล้ว'),
  ],
  fnd_v7_how_do_you_go: [
    task('วันนี้เราจะบอกวิธีเดินทางครับ ใช้ go by ตามด้วยพาหนะ “I go by bus.” แปลว่าฉันเดินทางโดยรถเมล์ ลองพูดตามครับ', 'I go by bus.', [], '', false, SHORT),
    choiceTask('สมมติว่าคุณเดินทางโดยรถไฟครับ ลองเปลี่ยนพาหนะ', 'I go by train.', 'I go by ...', [
      { emoji: '🚌', label: 'bus', speak: 'I go by bus.' },
      { emoji: '🚆', label: 'train', speak: 'I go by train.' },
      { emoji: '🚕', label: 'taxi', speak: 'I go by taxi.' },
    ], recap('I go by train.', 'ฉันเดินทางโดยรถไฟ'), false, 'รถไฟใช้ train แล้วพูดว่า I go by train. ครับ'),
    task('ถ้าถามอีกฝ่าย ใช้ Do you… ที่เรียนแล้วครับ “Do you go by train?” แปลว่าคุณเดินทางโดยรถไฟไหม ลองถามครูครับ', 'Do you go by train?', [], '', false, SHORT + 'Yes, I do. เดินทางโดยรถไฟครับ '),
    choiceTask('คราวนี้ลองถามครูว่าเดินทางโดยแท็กซี่ไหมครับ', 'Do you go by taxi?', 'Do you go by ...?', [
      { emoji: '🚆', label: 'train', speak: 'Do you go by train?' },
      { emoji: '🚕', label: 'taxi', speak: 'Do you go by taxi?' },
    ], recap('Do you go by taxi?', 'คุณเดินทางโดยแท็กซี่ไหม') + 'No, I don’t. ไม่ได้เดินทางโดยแท็กซี่ครับ ', false, 'แท็กซี่ใช้ taxi แล้วถามว่า Do you go by taxi? ครับ'),
    choiceTask('สมมติว่าคุณกำลังเลือกวิธีเดินทาง ตอบได้ตามที่อยากเลือกครับ “Do you go by bus?”', 'Yes, I do.', '', [
      { emoji: '🙂', label: 'Yes', speak: 'Yes, I do.', recapText: 'Yes, I do. ในคำถามนี้หมายถึง “ฉันเดินทางโดยรถเมล์” ครับ ' },
      { emoji: '🙅', label: 'No', speak: "No, I don't.", recapText: 'No, I don’t. ในคำถามนี้หมายถึง “ฉันไม่ได้เดินทางโดยรถเมล์” ครับ ' },
    ], undefined, true, 'ตอบ Yes, I do. หรือ No, I don’t. ครับ'),
    choiceTask('เลือกวิธีเดินทางสำหรับทริปสมมติอีกหนึ่งทริป แล้วพูดประโยคเต็มครับ', 'I go by bus.', 'I go by ...', [
      { emoji: '🚌', label: 'bus', speak: 'I go by bus.', meaningTh: 'ฉันเดินทางโดยรถเมล์' },
      { emoji: '🚆', label: 'train', speak: 'I go by train.', meaningTh: 'ฉันเดินทางโดยรถไฟ' },
      { emoji: '🚕', label: 'taxi', speak: 'I go by taxi.', meaningTh: 'ฉันเดินทางโดยแท็กซี่' },
    ], undefined, true, 'เลือกพาหนะแล้วพูดว่า I go by… ครับ'),
    finish('จบบทครับ วันนี้ฝึกบอกพาหนะและถามวิธีเดินทางด้วย go by แล้ว'),
  ],
  fnd_v7_goodbye_see_you: [
    task('วันนี้เราจะฝึกบอกลาก่อนจบบทสนทนาครับ 👋 Goodbye. แปลว่า “ลาก่อน” ใช้พูดเมื่อเราจะแยกกัน ลองพูดตามครับ', 'Goodbye.', [], '', false, SHORT),
    task('ถ้าบอกลาแบบเป็นกันเอง พูดว่า See you. แปลว่า “แล้วเจอกัน” ยังไม่ต้องระบุว่าจะเจอกันเมื่อไรครับ ลองพูดตาม', 'See you.', [], '', false, SHORT),
    choiceTask('ลองสมมติว่าคุณกำลังจะกลับบ้านครับ เลือกคำลาที่อยากพูดกับครูได้เลย', 'Goodbye.', '', [
      { emoji: '👋', label: 'Goodbye', speak: 'Goodbye.', meaningTh: 'ลาก่อน' },
      { emoji: '🙂', label: 'See you', speak: 'See you.', meaningTh: 'แล้วเจอกัน' },
    ], undefined, true, 'เลือกคำลาแล้วพูดทั้งวลีครับ'),
    task('ถ้ารู้ว่าจะเจอกันพรุ่งนี้ เติม tomorrow ซึ่งแปลว่า “พรุ่งนี้” ครับ See you tomorrow. แปลว่า “แล้วเจอกันพรุ่งนี้” ลองพูดตามครับ', 'See you tomorrow.', [], '', false, SHORT),
    choiceTask('สมมติว่าพรุ่งนี้คุณจะมาเรียนกับครูอีก ลองบอกครูว่า “แล้วเจอกันพรุ่งนี้” ครับ', 'See you tomorrow.', 'See you ...', [
      { emoji: '🗓️', label: 'tomorrow', speak: 'See you tomorrow.' },
    ], recap('See you tomorrow.', 'แล้วเจอกันพรุ่งนี้') + 'ครูตอบว่า See you tomorrow! 👋 ', false, 'เติม tomorrow แล้วพูดว่า See you tomorrow. ครับ'),
    finish('จบบทครับ วันนี้เราได้ฝึกบอกลาและบอกว่าจะเจอกันพรุ่งนี้แล้ว'),
  ],
  fnd_v7_please_and_thank_you: [
    task('วันนี้เราจะฝึกคำสุภาพที่ใช้เวลาขอของ ขอบคุณ และขอโทษครับ ถ้าอยากขอน้ำ ใช้ water ที่แปลว่าน้ำ แล้วเติม please ให้คำขอสุภาพขึ้น Water, please. หมายถึง “ขอน้ำหน่อยครับ” ลองพูดตามครับ', 'Water, please.', [], '', false, SHORT),
    task('ครูยื่นน้ำให้แล้ว 💧 เมื่อได้รับของหรือมีคนช่วยเรา พูดว่า Thank you. แปลว่า “ขอบคุณ” ลองขอบคุณครูครับ', 'Thank you.', [], '', false, SHORT),
    task('ถ้ามีคนเสนอของให้ แล้วเราอยากรับ พูดว่า Yes, please. หมายถึง “รับครับ ขอบคุณ” สมมติว่าครูถามว่า “รับน้ำไหมครับ” และคุณอยากรับ ลองตอบเป็นภาษาอังกฤษครับ', 'Yes, please.', [], '', false, SHORT),
    choiceTask('คราวนี้เพื่อนช่วยเปิดประตูให้ เพราะคุณถือของเต็มมือ 🚪 คุณจะพูดอะไรกับเพื่อน?', 'Thank you.', '', [
      { emoji: '🙏', label: 'Yes, please', speak: 'Yes, please.' },
      { emoji: '💝', label: 'Thank you', speak: 'Thank you.' },
    ], recap('Thank you.', 'ขอบคุณ'), false, 'เพื่อนช่วยเปิดประตูให้แล้ว ใช้ Thank you. ครับ'),
    task('ระหว่างเดิน คุณเผลอชนเพื่อนครับ เมื่อเราทำผิดหรือทำให้อีกฝ่ายเดือดร้อน ใช้ Sorry. แปลว่า “ขอโทษ” ลองพูดตามครับ', 'Sorry.', [], '', false, SHORT),
    task('อีกคำหนึ่งคือ Excuse me. ใช้เรียกความสนใจอย่างสุภาพก่อนเริ่มพูด เช่น จะเรียกพนักงาน ใช้ในความหมายว่า “ขอโทษนะครับ” ลองพูดตามครับ', 'Excuse me.', [], '', false, SHORT),
    choiceTask('พนักงานยังไม่เห็นคุณ และคุณอยากเรียกเขาครับ 🙋 จะเริ่มด้วยคำไหน?', 'Excuse me.', '', [
      { emoji: '😔', label: 'Sorry', speak: 'Sorry.' },
      { emoji: '🙋', label: 'Excuse me', speak: 'Excuse me.' },
    ], 'Excuse me. ในสถานการณ์นี้หมายถึง “ขอโทษนะครับ” เพื่อเรียกพนักงานครับ ', false, 'อยากเรียกพนักงานใช้ Excuse me. ครับ'),
    choiceTask('คราวนี้คุณเผลอเหยียบเท้าเพื่อนครับ จะพูดอะไรกับเขา?', 'Sorry.', '', [
      { emoji: '😔', label: 'Sorry', speak: 'Sorry.' },
      { emoji: '💝', label: 'Thank you', speak: 'Thank you.' },
    ], recap('Sorry.', 'ขอโทษ'), false, 'เผลอเหยียบเท้าเพื่อนแล้วใช้ Sorry. ครับ'),
    finish('จบบทแล้ว วันนี้เราได้ฝึกขอและรับของอย่างสุภาพ ขอบคุณ ขอโทษ และเรียกความสนใจก่อนพูดครับ'),
  ],
  fnd_v7_say_that_again: [
    task('เคยฟังภาษาอังกฤษแล้วไม่ทันไหมครับ? วันนี้เราจะฝึกขอให้อีกฝ่ายพูดซ้ำ พูดช้าลง และบอกเมื่อยังไม่เข้าใจ ไม่ต้องเดาครับ เริ่มด้วย “Please say that again.” ลองพูดตามครับ', 'Please say that again'),
    task('ถ้าอีกฝ่ายพูดเร็ว ขอให้ช้าลงด้วย Please speak slowly ครับ ลองพูดตาม', 'Please speak slowly'),
    task('อีกฝ่ายกำลังพูดเร็วมาก คุณอยากให้เขาลดความเร็ว จะขออย่างไรครับ', 'Please speak slowly', ['Please say that again', 'Please speak slowly']),
    task('ถ้ายังไม่เข้าใจ บอกได้ว่า I do not understand ครับ ลองพูดตาม', 'I do not understand'),
    task('ได้ยินชัดแล้ว แต่ยังไม่เข้าใจความหมายครับ จะบอกอีกฝ่ายอย่างไร', 'I do not understand', ['Please speak slowly', 'I do not understand']),
    task('ลองคุยจริงกันครับ สมมติครูเพิ่งบอกชื่อ แต่คุณฟังชื่อไม่ทัน ขอให้ครูพูดอีกครั้งโดยไม่ดูตัวช่วยครับ', 'Please say that again'),
    finish('ครูพูดซ้ำว่า My name is Teacher B. ชื่อของครูคือ Teacher B ครับ จบบทแล้วครับ คุณได้ฝึกขอซ้ำ ขอช้า และบอกว่าไม่เข้าใจ เวลาเจอสถานการณ์นี้ใช้วลีเหล่านี้ช่วยตัวเองได้ครับ'),
  ],
};
