import type { V7TeachingStep } from './foundation-v7-lessons.data';
const icons: Record<string, string> = { coffee: '☕', tea: '🍵', water: '💧', rice: '🍚', Please: '🙏', 'Thank you': '💝', Sorry: '😔', 'Excuse me': '🙋', 'Please say that again': '🔁', 'Please speak slowly': '🐢', 'I do not understand': '🤔' };

// V1 pacing: teach a small chunk, use it immediately, then transfer it.
const task = (text: string, expectedSpeech: string, labels: string[] = [], stem = '', any = false): V7TeachingStep => ({
  kind: 'recall', instruction: text, expectsUserSpeech: true, expectedSpeech,
  presentation: { text, answerMode: any ? 'any' : 'single', options: labels.map(label => ({
    emoji: icons[label] ?? '🔢', label, speak: stem + label,
  })), stem },
});
const finish = (text: string): V7TeachingStep => ({ kind: 'complete', instruction: text,
  expectsUserSpeech: false, presentation: { text, answerMode: 'single', options: [], stem: '' } });

export const V7_LEGACY_FLOWS: Record<string, V7TeachingStep[]> = {
  fnd_v7_please_and_thank_you: [
    task('วันนี้ฝึกคำสุภาพในชีวิตประจำวันครับ please ใช้กับคำขอ เช่น Water, please. คือขอน้ำครับ ลองฝึกคำว่า Please', 'Please'),
    task('เมื่อมีคนช่วยเรา ใช้ Thank you แปลว่าขอบคุณครับ ลองพูด Thank you', 'Thank you'),
    task('คุณถือของหนัก เพื่อนช่วยเปิดประตูให้แล้วครับ คุณจะพูดอะไรกับเพื่อน', 'Thank you', ['Please', 'Thank you']),
    task('Sorry ใช้ขอโทษเมื่อเราทำผิด เช่นเดินชนคนโดยไม่ตั้งใจครับ ลองพูด Sorry', 'Sorry'),
    task('ระหว่างเดินออกจากห้อง คุณเผลอชนเพื่อนครับ จะพูดอะไรกับเขา', 'Sorry', ['Thank you', 'Sorry', 'Please']),
    task('ถ้าจะเรียกความสนใจก่อนเริ่มพูด ใช้ Excuse me ครับ ไม่ต้องรอให้ทำผิด ลองพูด Excuse me', 'Excuse me'),
    task('คุณอยากเรียกพนักงานที่ยังไม่เห็นคุณ จะเริ่มทักเขาอย่างสุภาพว่าอะไรครับ', 'Excuse me'),
    finish('จบบทแล้วครับ วันนี้ฝึก Please สำหรับคำขอ Thank you เมื่อได้รับความช่วยเหลือ Sorry เมื่อทำผิด และ Excuse me ก่อนเริ่มทักครับ'),
  ],
  fnd_v7_say_that_again: [
    task('ฟังไม่ทัน ไม่ต้องเดาครับ ขอให้พูดอีกครั้งด้วย Please say that again ลองพูดตามครับ', 'Please say that again'),
    task('ถ้าอีกฝ่ายพูดเร็ว ขอให้ช้าลงด้วย Please speak slowly ครับ ลองพูดตาม', 'Please speak slowly'),
    task('อีกฝ่ายกำลังพูดเร็วมาก คุณอยากให้เขาลดความเร็ว จะขออย่างไรครับ', 'Please speak slowly', ['Please say that again', 'Please speak slowly']),
    task('ถ้ายังไม่เข้าใจ บอกได้ว่า I do not understand ครับ ลองพูดตาม', 'I do not understand'),
    task('ได้ยินชัดแล้ว แต่ยังไม่เข้าใจความหมายครับ จะบอกอีกฝ่ายอย่างไร', 'I do not understand', ['Please speak slowly', 'I do not understand']),
    task('ลองคุยจริงกันครับ สมมติครูเพิ่งบอกชื่อ แต่คุณฟังชื่อไม่ทัน ขอให้ครูพูดอีกครั้งโดยไม่ดูตัวช่วยครับ', 'Please say that again'),
    finish('ครูพูดซ้ำว่า My name is Teacher B. ชื่อของครูคือ Teacher B ครับ จบบทแล้วครับ คุณได้ฝึกขอซ้ำ ขอช้า และบอกว่าไม่เข้าใจ เวลาเจอสถานการณ์นี้ใช้วลีเหล่านี้ช่วยตัวเองได้ครับ'),
  ],
  fnd_v7_prices_and_paying: [
    task('วันนี้ลองซื้อตั๋วหนึ่งใบครับ ticket คือตั๋ว ขออย่างสุภาพว่า One ticket, please ลองพูดตามครับ', 'One ticket, please'),
    task('อยากรู้ราคา ถามว่า How much is it? แปลว่าราคาเท่าไหร่ครับ ลองพูดตาม', 'How much is it?'),
    task('baht คือบาทครับ Thirty baht คือสามสิบบาท ถ้าราคาสี่สิบบาท พูดเป็นประโยคว่า It is forty baht ลองพูดประโยคนี้ครับ', 'It is forty baht'),
    task('ลองอ่านป้ายราคาใหม่ครับ 🏷️ 30 บาท บอกราคาโดยเริ่มด้วย It is … baht ครับ', 'It is thirty baht', ['thirty baht', 'forty baht'], 'It is '),
    task('ตอนยื่นเงินให้อีกฝ่าย พูดว่า Here you are ครับ ลองพูดตาม', 'Here you are'),
    task('ลองซื้อตั๋วกันครับ คุณอยู่หน้าเคาน์เตอร์และต้องการตั๋วหนึ่งใบ เริ่มขอตั๋วกับพนักงานครับ', 'One ticket, please'),
    task('พนักงานหยิบตั๋วให้ดูแล้ว แต่ยังไม่ได้บอกราคาครับ ลองถามราคาต่อได้เลย', 'How much is it?'),
    task('พนักงานตอบว่า It is forty baht. คุณเตรียมเงินพอดีและกำลังยื่นให้เขาครับ ตอนส่งเงินจะพูดว่าอะไร', 'Here you are'),
    finish('พนักงานรับเงินและส่งตั๋วให้ พร้อมพูด Thank you. จบบทแล้วครับ วันนี้ฝึกขอตั๋ว ถามและฟังราคาเป็นบาท แล้วพูดตอนยื่นเงินครับ'),
  ],
  fnd_v7_numbers_0_10: [
    task('วันนี้ฝึกอ่านเลขที่เจอในชีวิตประจำวันครับ ศูนย์ถึงห้าคือ zero, one, two, three, four, five ลองนับแอปเปิลแล้วพูดจำนวนเป็นอังกฤษครับ 🍎🍎🍎🍎', 'four', ['zero', 'three', 'four', 'five']),
    task('ต่อไปหกถึงสิบครับ six, seven, eight, nine, ten บัตรคิวของคุณคือเลข 7 🎫 ลองอ่านเลขคิวเป็นอังกฤษครับ', 'seven', ['six', 'seven', 'nine', 'ten']),
    task('ถึงห้องแล้วครับ 🚪 8 ห้องนี้เลขอะไร พูดเป็นอังกฤษครับ', 'eight', ['six', 'eight', 'nine', 'ten']),
    task('เลขศูนย์ถึงสิบ คุณชอบเลขไหนครับ เลือกเลขที่ชอบแล้วพูดได้เลย ไม่จำเป็นต้องเลือกจากตัวช่วยครับ', 'three', ['three', 'five', 'eight', 'ten'], '', true),
    finish('จบบทแล้วครับ วันนี้คุณได้ฝึกนับของ อ่านเลขคิว และเลขห้องครับ'),
  ],
  fnd_v7_eleven_to_twenty: [
    task('สิบเอ็ดคือ eleven สิบสองคือ twelve ครับ ลองพูด twelve', 'twelve'),
    task('สิบสาม thirteen สิบสี่ fourteen สิบห้า fifteen ครับ ลงท้ายด้วย teen ลองอ่านเลขห้อง 🚪 14 ครับ', 'fourteen', ['thirteen', 'fourteen', 'fifteen']),
    task('อีกห้องหนึ่งคือ 🚪 13 ลองอ่านเองครับ', 'thirteen', ['twelve', 'thirteen', 'fourteen']),
    task('สิบหกถึงสิบเก้าคือ sixteen, seventeen, eighteen, nineteen ครับ บัตรคิว 🎫 18 อ่านว่าอะไรครับ', 'eighteen', ['sixteen', 'seventeen', 'eighteen', 'nineteen']),
    task('ยี่สิบคือ twenty ครับ ลงท้ายด้วย ty ลองพูด twenty', 'twenty'),
    task('ใช้บอกอายุได้ด้วยครับ ฉันอายุสิบสองปี คือ I am twelve years old. ลองพูดตามครับ', 'I am twelve years old.'),
    task('สมมติว่าคุณอายุยี่สิบปี ลองบอกอายุด้วยรูป I am … years old. ครับ', 'I am twenty years old.'),
    finish('จบบทแล้วครับ วันนี้ฝึกอ่านเลขสิบเอ็ดถึงยี่สิบ และนำไปบอกอายุครับ'),
  ],
  fnd_v7_twenty_to_one_hundred: [
    task('ยี่สิบคือ twenty สามสิบ thirty สี่สิบ forty ห้าสิบ fifty ลองพูด forty ครับ', 'forty'),
    task('ป้ายราคา 🏷️ 50 บาท ลองอ่านเฉพาะตัวเลขเป็นอังกฤษครับ', 'fifty', ['thirty', 'forty', 'fifty']),
    task('หกสิบถึงหนึ่งร้อยคือ sixty, seventy, eighty, ninety, one hundred ครับ ลองพูด eighty', 'eighty'),
    task('รถเมล์ 🚌 70 มาแล้วครับ ลองอ่านเลขสายเป็นอังกฤษ', 'seventy', ['sixty', 'seventy', 'eighty', 'ninety']),
    task('ประกอบเลขได้เลยครับ สามสิบห้าคือ thirty กับ five รวมเป็น thirty-five ลองพูด thirty-five ครับ', 'thirty-five'),
    task('ลองประกอบเลขใหม่ครับ 🚪 62 ห้องนี้เลขอะไร พูดเป็นอังกฤษได้เลย', 'sixty-two'),
    finish('จบบทแล้วครับ วันนี้ฝึกอ่านราคา เลขรถเมล์ และประกอบเลขสองหลักครับ'),
  ],
  fnd_v7_i_like_i_dont_like: [
    task('coffee คือกาแฟครับ ฉันชอบกาแฟพูดว่า I like coffee. ลองพูดตามครับ', 'I like coffee.'),
    task('tea คือชาครับ ถ้าคุณชอบชา จะพูดว่าอย่างไร ใช้ I like … ครับ', 'I like tea', ['tea', 'coffee'], 'I like '),
    task('ถ้าไม่ชอบ เติม don’t ครับ ฉันไม่ชอบชาคือ I don’t like tea. ลองพูดตามครับ', 'I don’t like tea.'),
    task('rice คือข้าว 🍚 และ water คือน้ำ 💧 ครับ ถ้าคุณชอบข้าว จะพูดว่าอย่างไร', 'I like rice', ['rice', 'water'], 'I like '),
    task('คราวนี้บอกสิ่งที่คุณชอบจริง ๆ ครับ ใช้ I like … เลือกได้ทุกคำ หรือบอกสิ่งอื่นที่คุณชอบได้เลย', 'I like coffee', ['coffee', 'tea', 'water', 'rice'], 'I like ', true),
    finish('จบบทแล้วครับ วันนี้คุณได้ฝึกบอกว่าชอบและไม่ชอบอะไร ขอบคุณที่แบ่งปันครับ'),
  ],
};
