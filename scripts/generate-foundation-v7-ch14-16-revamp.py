#!/usr/bin/env python3
"""Generate Foundation V7 Ch14–16 revamp catalog + content stubs."""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "src/learn-path/foundation-v7-path.catalog.json"
NW_PATH = ROOT / "src/new-words/new-words-pools.json"
SAY_IT_PATH = ROOT / "src/say-it/foundation-v7-pools.json"
LESSON_AUTH = ROOT / "src/lessons/foundation-v7-lessons.authoring.json"
SIM_AUTH = ROOT / "src/simulations/foundation-v7-simulations.authoring.json"
INFO_TASK_PATH = ROOT / "src/info-task/info-task-pools.json"
MIGRATION_PATH = ROOT / "src/learn-path/foundation-v7-ch14-16-migration.ts"
EMOJI_PATH = ROOT / "src/emoji-speak/foundation-v7-pools.json"

AXES = [2, 1, 1, 1, 1]
EM = [3, 5]
EM_SHORT = [2, 4]


def node(
    nid: str,
    code: str,
    order: int,
    global_order: int,
    title_en: str,
    title_th: str,
    ntype: str,
    beat: str,
    learning_target: str,
    activity: str,
    examples: list[str],
    content_ref: dict,
    *,
    estimated=None,
    axes=None,
    coming_soon_note: str | None = None,
    legacy_sim: list[str] | None = None,
    pronunciation: dict | None = None,
):
    item = {
        "id": nid,
        "code": code,
        "order": order,
        "globalOrder": global_order,
        "titleEn": title_en,
        "titleTh": title_th,
        "type": ntype,
        "beat": beat,
        "learningTarget": learning_target,
        "activity": activity if not coming_soon_note else coming_soon_note,
        "examples": examples,
        "estimatedMinutes": estimated or EM,
        "difficultyAxes": axes or AXES,
        "contentRef": content_ref,
    }
    if legacy_sim:
        item["legacySimulationIds"] = legacy_sim
    if pronunciation:
        item["pronunciation"] = pronunciation
    return item


def say_it_pool(topic_id: str, items: list[tuple[str, str, list[str] | None]]):
    out = []
    for i, (prompt, answer, accepted) in enumerate(items, 1):
        entry = {
            "id": f"{topic_id}_q{i}",
            "promptTh": prompt,
            "answerEn": answer,
            "acceptedAnswers": accepted or [],
        }
        out.append(entry)
    return out


def lesson_auth(title_en, title_th, goal_th, scope, models_blocks, recall_prompt, recall_answer):
    return {
        "titleEn": title_en,
        "titleTh": title_th,
        "goalTh": goal_th,
        "scope": scope,
        "estimatedMinutes": EM,
        "blocks": [
            {"tipTh": tip, "models": models, "repeat": models[0]}
            for tip, models in models_blocks
        ],
        "recall": {"promptTh": recall_prompt, "answerEn": recall_answer},
    }


def main():
    catalog = json.loads(CATALOG_PATH.read_text())
    # Keep chapters 1–13
    head = [ch for ch in catalog["chapters"] if ch["number"] <= 13]
    go = max(n["globalOrder"] for ch in head for n in ch["items"])

    # --- Chapter 14: Ask About People & Things (11) ---
    ch14_items = []
    specs14 = [
        ("v7_u14n07", "14.1", "What & Who", "What กับ Who", "new_words", "Ki",
         "จำเจตนา what / who", "New Words สองคำ: what ถามว่าสิ่งนั้นคืออะไรในตัวอย่างเหล่านี้; who ถามตัวตน",
         ["what", "who"], {"poolId": "new_words_what_who"}, EM_SHORT, [1, 1, 2, 1, 1]),
        ("v7_u14n01", "14.2", "What Is This?", "นี่คืออะไร?", "lesson", "Ki",
         "ถาม What is this? / What is that? สำหรับสิ่งของใกล้/ไกล",
         "โมเดลใกล้-ไกลแล้วให้ผู้เรียนถามเอง; ยังไม่ถามพหูพจน์",
         ["What is this?", "What is that?"], {"lessonId": "fnd_v7_what_is_this"}, EM, AXES),
        ("v7_u14n12", "14.3", "Ask About Things", "ถามเกี่ยวกับสิ่งของ", "say_it", "Sho",
         "ถาม What is this? / What is that? ตามระยะ",
         "ห้าบริบทใกล้-ไกล; ไม่เปิดเผยชื่อสิ่งของในภาษาอังกฤษในคำใบ้",
         ["What is this?", "What is that?"], {"topicId": "fnd_v7_u14n12"}, EM_SHORT, AXES),
        ("v7_u14n09", "14.4", "Who Is This?", "คนนี้คือใคร?", "lesson", "Ki",
         "ถาม Who is this/she/he? เพื่อหาตัวตน",
         "แยกคนกับสิ่งของ; ตอบด้วยชื่อ/ตัวตนก่อน ไม่บังคับอาชีพ",
         ["Who is this?", "Who is she?", "Who is he?"], {"lessonId": "fnd_v7_who_is_this"}, EM, AXES),
        ("v7_u14n10", "14.5", "People or Things?", "คนหรือสิ่งของ?", "say_it", "Ten",
         "เลือก What หรือ Who ให้ถูกตามข้อมูลที่ขาด",
         "ผสมคนกับสิ่งของใกล้/ไกล/ในรูป",
         ["Who is she?", "What is this?", "Who is he?", "What is that?", "Who is this?"],
         {"topicId": "fnd_v7_u14n10"}, EM_SHORT, AXES),
        ("v7_u14n08", "14.6", "Where, Here & There", "Where, Here และ There", "new_words", "Ki",
         "จำ where / here / there สำหรับตำแหน่ง",
         "here/there บอกตำแหน่งที่นี่/ที่นั่น; ยังไม่สอน There is",
         ["where", "here", "there"], {"poolId": "new_words_where_here_there"}, EM_SHORT, [1, 1, 2, 1, 1]),
        ("v7_u14n11", "14.7", "Where Is My Bag?", "กระเป๋าฉันอยู่ไหน?", "lesson", "Sho",
         "ถาม Where is…? เพื่อหาตำแหน่งของ/คนที่รู้จักแล้ว",
         "รับคำตอบ here/there/in Room 2; อธิบาย in Room 2 เป็นชิ้นรับ",
         ["Where is my bag?", "Where is Max?", "Where is it?"],
         {"lessonId": "fnd_v7_where_is_my_bag"}, EM, AXES),
        ("v7_u14n13", "14.8", "Find My Things", "หาของของฉัน", "say_it", "Sho",
         "ถาม Where is my…? / Where is it?",
         "ห้าบริบทหาของ/คน; Where is it? มี antecedent ชัด",
         ["Where is my bag?", "Where is my phone?", "Where is Max?"],
         {"topicId": "fnd_v7_u14n13"}, EM_SHORT, AXES),
        ("v7_u14n14", "14.9", "What Do You Want to Know?", "อยากรู้อะไร?", "lesson", "Ten",
         "เลือก What / Who / Where ตามข้อมูลที่ขาด",
         "ห้าสถานการณ์สั้น; แต่ละคำถามได้คำตอบจริงก่อนงานถัดไป",
         ["Who is he?", "Where is Max?", "What is this?"],
         {"lessonId": "fnd_v7_what_do_you_want_to_know"}, EM, AXES),
        ("v7_u14n04", "14.10", "Ask the Right Question", "ถามคำถามให้ถูก", "say_it", "Ten",
         "ถาม What / Who / Where จากพูลผสม",
         "ห้าข้อต่อรอบจากพูลสมดุล; ไม่เปิดเผยคำถามอังกฤษโดยค่าเริ่มต้น",
         ["What is that?", "Who is she?", "Where is my bag?"],
         {"topicId": "fnd_v7_u14n04"}, EM_SHORT, AXES),
        ("v7_u14n15", "14.11", "Meet Your Teacher", "พบครูของคุณ", "conversation", "Ketsu",
         "ถามว่าผู้ชายในรูปคือใคร ครูอยู่ที่ไหน และห้องนั้นอยู่ตรงไหน",
         "ถาม Mali ที่เคาน์เตอร์ต้อนรับจากรูปครู John",
         ["Who is he?", "Where is John?", "Where is Room 2?"],
         {"simulationId": "foundation_v7_u14n15"}, EM, AXES),
    ]
    for i, row in enumerate(specs14, 1):
        go += 1
        (nid, code, te, tt, typ, beat, lt, act, ex, cref, em, ax) = row
        ch14_items.append(node(nid, code, i, go, te, tt, typ, beat, lt, act, ex, cref, estimated=em, axes=ax))

    ch14 = {
        "id": "v7_u14",
        "number": 14,
        "titleEn": "Ask About People & Things",
        "titleTh": "ถามเกี่ยวกับคนและสิ่งของ",
        "outcome": "เลือก What / Who / Where ตามข้อมูลที่ต้องการ แล้วถามออกมา",
        "items": ch14_items,
    }

    # --- Chapter 15: Time, Prices & Numbers (21) ---
    ch15_items = []
    specs15 = [
        ("v7_u14tn01", "15.1", "When or What Time?", "When หรือ What Time?", "lesson", "Ki",
         "แยก When กับ What time ตามข้อมูลที่ขาด", "วัน vs นาฬิกา; ทบทวน Where is the class?",
         ["When is the class?", "What time is the class?"], {"lessonId": "fnd_v7_when_or_what_time"}, EM, AXES),
        ("v7_u14tn02", "15.2", "Ask About the Class", "ถามเรื่องคลาส", "say_it", "Sho",
         "ถาม When / What time / Where เกี่ยวกับคลาส", "ห้าบริบทตารางเรียน",
         ["When is the class?", "What time is the class?", "Where is the class?"],
         {"topicId": "fnd_v7_u14tn02"}, EM_SHORT, AXES),
        ("v7_u14tn03", "15.3", "Months 1", "เดือน 1", "new_words", "Ki",
         "จำ January / February / March", "ชุดเดือนแรก สามคำ พร้อมเสียงและคำแปล",
         ["January", "February", "March"], {"poolId": "new_words_months_1"}, EM_SHORT, [1, 1, 2, 1, 1]),
        ("v7_u14tn04", "15.4", "In Which Month?", "เดือนไหน?", "lesson", "Sho",
         "ใช้ in + month สำหรับวันเกิดและคลาส", "สอน birthday ในบท; เปรียบ on Friday กับ in March",
         ["My birthday is in January.", "The class is in March."],
         {"lessonId": "fnd_v7_in_which_month"}, EM, AXES),
        ("v7_u14tn05", "15.5", "Months & Days 1", "เดือนและวัน 1", "say_it", "Sho",
         "พูด in + month และ on + day / at + time", "ทบทวนเดือน 1 กับวันเวลา",
         ["My birthday is in January.", "The class is on Friday."],
         {"topicId": "fnd_v7_u14tn05"}, EM_SHORT, AXES),
        ("v7_u14tn06", "15.6", "Months 2", "เดือน 2", "new_words", "Ki",
         "จำ April / May / June", "ชุดเดือนที่สอง",
         ["April", "May", "June"], {"poolId": "new_words_months_2"}, EM_SHORT, [1, 1, 2, 1, 1]),
        ("v7_u14tn07", "15.7", "Read the Calendar 1", "อ่านปฏิทิน 1", "info_task", "Ten",
         "อ่านวันที่เขียนแบบ 5 May และเลือกข้อมูลจากบัตร",
         "Coming Soon: information-task renderer — calendar cards January–June",
         ["5 May", "8 June"], {"poolId": "info_task_calendar_1"}, EM_SHORT, AXES),
        ("v7_u14tn08", "15.8", "Plan My Class", "วางแผนคลาสของฉัน", "conversation", "Ketsu",
         "ถามวัน เวลา และห้องเรียน", "สามคำถามข้อมูล; ไม่ให้ NPC ตอบครบในคำตอบแรก",
         ["When is the class?", "What time is the class?", "Where is the class?"],
         {"simulationId": "foundation_v7_u14n06"}, EM, AXES),
        ("v7_u14tn09", "15.9", "How Much & How Many", "How Much และ How Many", "new_words", "Ki",
         "จำ how much / how many ในบริบทซื้อของ", "สองวลี: ราคา vs จำนวน",
         ["how much", "how many"], {"poolId": "new_words_how_much_how_many"}, EM_SHORT, [1, 1, 2, 1, 1]),
        ("v7_u14tn10", "15.10", "How Much Is It?", "ราคาเท่าไร?", "lesson", "Sho",
         "ถามราคาด้วย How much is…?", "หกการถามราคาสั้น; ตัวเลขที่เรียนแล้ว",
         ["How much is it?", "How much is the bag?"], {"lessonId": "fnd_v7_how_much_is_it"}, EM, AXES),
        ("v7_u14tn11", "15.11", "Ask the Price", "ถามราคา", "say_it", "Sho",
         "ถามราคาและทบทวน Where เมื่อรู้ราคาแล้ว", "รวม Where is the bag? เมื่อรู้ราคาแล้ว",
         ["How much is it?", "How much is one ticket?"], {"topicId": "fnd_v7_u14tn11"}, EM_SHORT, AXES),
        ("v7_u14tn12", "15.12", "Months 3", "เดือน 3", "new_words", "Ki",
         "จำ July / August / September", "ชุดเดือนที่สาม",
         ["July", "August", "September"], {"poolId": "new_words_months_3"}, EM_SHORT, [1, 1, 2, 1, 1]),
        ("v7_u14tn13", "15.13", "Months & Days 2", "เดือนและวัน 2", "say_it", "Sho",
         "ใช้เดือนชุด 3 และทบทวน May / Monday", "กรอบ birthday / class",
         ["My birthday is in July.", "The class is in May."],
         {"topicId": "fnd_v7_u14tn13"}, EM_SHORT, AXES),
        ("v7_u14tn14", "15.14", "How Many?", "กี่ชิ้น?", "lesson", "Ten",
         "ถามจำนวนด้วย How many…?", "บริบทขอให้นำ/ซื้อของ; ไม่ถามจากรูปที่เห็นจำนวนแล้ว",
         ["How many books?", "How many tickets?"], {"lessonId": "fnd_v7_how_many"}, EM, AXES),
        ("v7_u14tn15", "15.15", "Price or Number?", "ราคาหรือจำนวน?", "say_it", "Ten",
         "แยก How much กับ How many", "ห้าข้อผสมราคาและจำนวน",
         ["How many books?", "How much is the book?"], {"topicId": "fnd_v7_u14tn15"}, EM_SHORT, AXES),
        ("v7_u14tn16", "15.16", "Months 4", "เดือน 4", "new_words", "Ki",
         "จำ October / November / December", "ชุดเดือนสุดท้าย",
         ["October", "November", "December"], {"poolId": "new_words_months_4"}, EM_SHORT, [1, 1, 2, 1, 1]),
        ("v7_u14tn17", "15.17", "Read the Calendar 2", "อ่านปฏิทิน 2", "info_task", "Ten",
         "อ่านวันที่ Oct–Dec และเดือนก่อนหน้า",
         "Coming Soon: information-task renderer — calendar cards with later months",
         ["12 October", "Room 3"], {"poolId": "info_task_calendar_2"}, EM_SHORT, AXES),
        ("v7_u14tn18", "15.18", "Months I Remember", "เดือนที่จำได้", "say_it", "Ten",
         "ทบทวนทั้ง 12 เดือน", "ห้าข้อต่อรอบจากพูล 12 เดือน",
         ["My birthday is in October.", "The class is in March."],
         {"topicId": "fnd_v7_u14tn18"}, EM_SHORT, AXES),
        ("v7_u14tn19", "15.19", "Read My Ticket", "อ่านตั๋วของฉัน", "info_task", "Ten",
         "ดึงวัน เวลา จำนวน ราคา หรือวันที่จากบัตรสั้น",
         "Coming Soon: information-task renderer — ticket/message cards",
         ["7:00", "50 baht", "5 May"], {"poolId": "info_task_ticket"}, EM_SHORT, AXES),
        ("v7_u14tn20", "15.20", "Questions in Real Life", "คำถามในชีวิตจริง", "say_it", "Ten",
         "ผสมคำถามตัวตน/ตาราง/ซื้อของ", "แต่ละรอบมี schedule + shopping + ทบทวน Ch14",
         ["When is the class?", "How much is one ticket?", "Who is she?"],
         {"topicId": "fnd_v7_u14tn20"}, EM_SHORT, AXES),
        ("v7_u14tn21", "15.21", "Plan a Movie", "วางแผนดูหนัง", "conversation", "Ketsu",
         "ถามวัน รอบฉาย และราคาตั๋วหนึ่งใบ", "โต๊ะตั๋ว; NPC Mali; ไม่บังคับ How many",
         ["When is the movie?", "What time is the movie?", "How much is one ticket?"],
         {"simulationId": "foundation_v7_u14tn21"}, EM, AXES),
    ]
    # Mark info_task nodes with coming soon activity already set
    for i, row in enumerate(specs15, 1):
        go += 1
        (nid, code, te, tt, typ, beat, lt, act, ex, cref, em, ax) = row
        ch15_items.append(node(nid, code, i, go, te, tt, typ, beat, lt, act, ex, cref, estimated=em, axes=ax))

    ch15 = {
        "id": "v7_u14_time_numbers",
        "number": 15,
        "titleEn": "Ask About Time, Prices & Numbers",
        "titleTh": "ถามเวลา ราคา และจำนวน",
        "outcome": "ถามตาราง ราคา และจำนวน; ใช้เดือน; อ่านข้อมูลสำคัญจากปฏิทิน/ข้อความ/ตั๋วสั้น",
        "items": ch15_items,
    }

    # --- Chapter 16: Things & Places (13) — keep v7_u15 id, renumber to 16 ---
    ch16_items = []
    specs16 = [
        ("v7_u15n10", "16.1", "Around the Room", "รอบห้อง", "new_words", "Ki",
         "จำ table / chair / window", "คำศัพท์ของในห้อง",
         ["table", "chair", "window"], {"poolId": "new_words_around_the_room"}, EM_SHORT, [1, 1, 2, 1, 1]),
        ("v7_u15n01", "16.2", "There Is / There Are", "There Is / There Are", "lesson", "Ki",
         "บอกว่ามีอะไรอยู่ในสถานที่ด้วย There is / There are",
         "หนึ่ง vs หลาย; อธิบายว่า There is ไม่ได้แปลว่า over there",
         ["There is a table.", "There are two chairs."], {"lessonId": "fnd_v7_there_is_there_are"}, EM, AXES),
        ("v7_u15n12", "16.3", "What Is in the Room?", "ในห้องมีอะไร?", "say_it", "Sho",
         "พูด There is / There are กับของที่คุ้นเคย", "ห้าประโยคมี/จำนวน",
         ["There is a table.", "There are two chairs."], {"topicId": "fnd_v7_u15n12"}, EM_SHORT, AXES),
        ("v7_u15n11", "16.4", "More Places & Things", "สถานที่และของเพิ่ม", "new_words", "Ki",
         "จำ door / bed / bathroom", "คำศัพท์เพิ่ม",
         ["door", "bed", "bathroom"], {"poolId": "new_words_places_and_fixtures"}, EM_SHORT, [1, 1, 2, 1, 1]),
        ("v7_u15n03", "16.5", "In, On, Under, Next To", "In, On, Under, Next To", "lesson", "Sho",
         "บอกตำแหน่งด้วย in / on / under / next to", "ฉากเดียวเปลี่ยนตำแหน่งของ",
         ["The book is in the bag.", "The book is on the table."],
         {"lessonId": "fnd_v7_in_on_under_next_to"}, EM, AXES),
        ("v7_u15n13", "16.6", "Where Is It?", "มันอยู่ไหน?", "say_it", "Sho",
         "บอกตำแหน่งและทบทวน There are", "รวม existence/number หนึ่งข้อ",
         ["The book is in the bag.", "There are two chairs."],
         {"topicId": "fnd_v7_u15n13"}, EM_SHORT, AXES),
        ("v7_u15n04", "16.7", "Find My Things", "หาของของฉัน", "describe_it", "Ten",
         "บรรยายตำแหน่งของจากภาพสั้น", "Coming Soon จนกว่า Describe It จะเปิด; พูล 6 ภาพ",
         ["The book is in the bag.", "The phone is on the table."],
         {"poolId": "fnd_v7_u15n04_find_my_things"}, EM, AXES),
        ("v7_u15n05", "16.8", "Word Stress I", "เน้นพยางค์ I", "pronunciation", "Ten",
         "ฝึก word stress กับคำที่คุ้นเคย", "คงบท pronunciation เดิม",
         ["table", "window", "doctor"],
         {"lessonId": "pron_stress_1"}, EM, AXES),
        ("v7_u15n06", "16.9", "Go Straight, Turn Left", "ตรงไป เลี้ยวซ้าย", "lesson", "Sho",
         "ใช้ทิศทางสั้น Go straight / Turn left / Turn right / Stop",
         "ชิ้นสั้นพร้อมลูกศร; รวมสองชิ้นท้ายบท",
         ["Go straight.", "Turn left.", "Turn right."],
         {"lessonId": "fnd_v7_go_straight_turn_left"}, EM, AXES),
        ("v7_u15n09", "16.10", "Direction Mix", "ทิศทางผสม", "emoji_speak", "Sho",
         "พูดทิศทางจากลูกศรชัดเจน", "คงพูลทิศทาง; หลีกเลี่ยง emoji ตำแหน่งคลุมเครือ",
         ["Go straight", "Turn left", "Turn right", "Stop"],
         {"poolId": "fnd_v7_u15n09"}, EM_SHORT, AXES),
        ("v7_u15n07", "16.11", "Say the Way", "บอกทาง", "say_it", "Ten",
         "พูดทิศทางเดี่ยวและคู่", "รวม Go straight and turn left/right",
         ["Go straight.", "Go straight and turn left."],
         {"topicId": "fnd_v7_u15n07"}, EM_SHORT, AXES),
        ("v7_u15n14", "16.12", "Listen & Find", "ฟังแล้วหา", "info_task", "Ten",
         "ฟังแล้วเลือกภาพ/เส้นทางที่ตรง",
         "Coming Soon: information-task audio mode — Listen & Find",
         ["The bag is under the chair.", "Go straight and turn left."],
         {"poolId": "info_task_listen_find"}, EM, AXES),
        ("v7_u15n08", "16.13", "Find the Room", "หาห้อง", "conversation", "Ketsu",
         "ถามห้อง 2 ห้องน้ำ และกระเป๋าที่ฝากไว้", "สามเป้าหมายข้อมูล; ไม่บังคับ Please say that again",
         ["Where is Room 2?", "Where is the bathroom?", "Where is my bag?"],
         {"simulationId": "foundation_v7_u15n08"}, EM, AXES),
    ]
    # pronunciation metadata from old node
    for i, row in enumerate(specs16, 1):
        go += 1
        (nid, code, te, tt, typ, beat, lt, act, ex, cref, em, ax) = row
        pron = None
        if nid == "v7_u15n05":
            pron = {
                "sourceCourse": "pronunciation",
                "sourceLessonId": "pron_stress_1",
                "soundTarget": "word_stress",
                "mode": "listen_repeat",
                "lexicalPreview": ["table", "window", "doctor"],
            }
        ch16_items.append(
            node(nid, code, i, go, te, tt, typ, beat, lt, act, ex, cref, estimated=em, axes=ax, pronunciation=pron)
        )

    ch16 = {
        "id": "v7_u15",
        "number": 16,
        "titleEn": "Things & Places",
        "titleTh": "สิ่งของและสถานที่",
        "outcome": "บอกว่ามีอะไร ระบุตำแหน่งของ เข้าใจทิศทางสั้น และใช้ข้อมูลตำแหน่งที่ได้ยิน",
        "items": ch16_items,
    }

    catalog["chapters"] = head + [ch14, ch15, ch16]
    catalog["metadata"]["totalNodeCount"] = sum(len(ch["items"]) for ch in catalog["chapters"])
    catalog["metadata"]["sourceVersion"] = "foundation-v7-ch14-16-revamp-2026-09"
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    print("catalog nodes", catalog["metadata"]["totalNodeCount"], "chapters", len(catalog["chapters"]))

    # --- New Words pools ---
    nw = json.loads(NW_PATH.read_text())
    nw["new_words_what_who"] = {
        "title": "What & Who",
        "items": [
            {"emoji": "❓", "answer": "what", "reading": "ว็อท", "meaningTh": "อะไร (ในตัวอย่างถามว่าสิ่งนั้นคืออะไร)"},
            {"emoji": "👤", "answer": "who", "reading": "ฮู", "meaningTh": "ใคร (ถามตัวตน)"},
        ],
    }
    nw["new_words_where_here_there"] = {
        "title": "Where, Here & There",
        "items": [
            {"emoji": "📍", "answer": "where", "reading": "แวร์", "meaningTh": "ที่ไหน"},
            {"emoji": "⬇️", "answer": "here", "reading": "เฮียร์", "meaningTh": "ที่นี่"},
            {"emoji": "➡️", "answer": "there", "reading": "แดร์", "meaningTh": "ที่นั่น"},
        ],
    }
    nw["new_words_months_1"] = {
        "title": "Months 1",
        "items": [
            {"emoji": "1️⃣", "answer": "January", "reading": "แจน-ยู-อะ-รี", "meaningTh": "มกราคม"},
            {"emoji": "2️⃣", "answer": "February", "reading": "เฟบ-รู-อะ-รี", "meaningTh": "กุมภาพันธ์"},
            {"emoji": "3️⃣", "answer": "March", "reading": "มาร์ช", "meaningTh": "มีนาคม"},
        ],
    }
    nw["new_words_months_2"] = {
        "title": "Months 2",
        "items": [
            {"emoji": "4️⃣", "answer": "April", "reading": "เอ-พริล", "meaningTh": "เมษายน"},
            {"emoji": "5️⃣", "answer": "May", "reading": "เมย์", "meaningTh": "พฤษภาคม"},
            {"emoji": "6️⃣", "answer": "June", "reading": "จูน", "meaningTh": "มิถุนายน"},
        ],
    }
    nw["new_words_months_3"] = {
        "title": "Months 3",
        "items": [
            {"emoji": "7️⃣", "answer": "July", "reading": "จู-ลาย", "meaningTh": "กรกฎาคม"},
            {"emoji": "8️⃣", "answer": "August", "reading": "ออ-กัสต์", "meaningTh": "สิงหาคม"},
            {"emoji": "9️⃣", "answer": "September", "reading": "เซป-เทม-เบอร์", "meaningTh": "กันยายน"},
        ],
    }
    nw["new_words_months_4"] = {
        "title": "Months 4",
        "items": [
            {"emoji": "🔟", "answer": "October", "reading": "อ็อก-โท-เบอร์", "meaningTh": "ตุลาคม"},
            {"emoji": "1️⃣1️⃣", "answer": "November", "reading": "โน-เวม-เบอร์", "meaningTh": "พฤศจิกายน"},
            {"emoji": "1️⃣2️⃣", "answer": "December", "reading": "ดี-เซม-เบอร์", "meaningTh": "ธันวาคม"},
        ],
    }
    nw["new_words_how_much_how_many"] = {
        "title": "How Much & How Many",
        "items": [
            {"emoji": "💰", "answer": "how much", "reading": "ฮาว มัช", "meaningTh": "เท่าไร (ราคา ในบริบทซื้อของ)"},
            {"emoji": "🔢", "answer": "how many", "reading": "ฮาว เมนี่", "meaningTh": "กี่ (จำนวน)"},
        ],
    }
    # Keep old clues pools for any leftover refs but update clues_1 to match what/who if needed
    NW_PATH.write_text(json.dumps(nw, ensure_ascii=False, indent=2) + "\n")

    # --- Say It pools ---
    say = json.loads(SAY_IT_PATH.read_text())
    say["fnd_v7_u14n12"] = say_it_pool("fnd_v7_u14n12", [
        ("มีของอยู่ในมือแต่ยังไม่รู้ว่าคืออะไร ลองถาม", "What is this?", ["What's this?"]),
        ("มีของอยู่บนโต๊ะใกล้ ๆ แต่ยังไม่รู้ว่าคืออะไร", "What is this?", ["What's this?"]),
        ("เห็นของบนชั้นไกล ๆ แต่ยังไม่รู้ว่าคืออะไร", "What is that?", ["What's that?"]),
        ("เพื่อนถือของอยู่ไกล ๆ คุณอยากรู้ว่าคืออะไร", "What is that?", ["What's that?"]),
        ("มีของวางข้างคุณ แต่ยังไม่รู้ว่าคืออะไร", "What is this?", ["What's this?"]),
    ])
    say["fnd_v7_u14n10"] = say_it_pool("fnd_v7_u14n10", [
        ("เห็นผู้หญิงคนหนึ่งแต่ยังไม่รู้ว่าเป็นใคร", "Who is she?", []),
        ("มีของอยู่ใกล้ ๆ แต่ยังไม่รู้ว่าคืออะไร", "What is this?", ["What's this?"]),
        ("เห็นผู้ชายคนหนึ่งแต่ยังไม่รู้ว่าเป็นใคร", "Who is he?", []),
        ("มีของอยู่ไกล ๆ แต่ยังไม่รู้ว่าคืออะไร", "What is that?", ["What's that?"]),
        ("มีคนในรูปแต่ยังไม่รู้ว่าเป็นใคร", "Who is this?", ["Who's this?"]),
    ])
    say["fnd_v7_u14n13"] = say_it_pool("fnd_v7_u14n13", [
        ("หาไม่เจอกระเป๋าของตัวเอง ลองถาม", "Where is my bag?", ["Where's my bag?"]),
        ("หาไม่เจอโทรศัพท์ของตัวเอง", "Where is my phone?", ["Where's my phone?"]),
        ("อยากรู้ว่า Max อยู่ที่ไหน", "Where is Max?", ["Where's Max?"]),
        ("หาไม่เจอหนังสือของตัวเอง", "Where is my book?", ["Where's my book?"]),
        ("พูดถึงกระเป๋าไปแล้ว อยากถามสั้น ๆ ว่ามันอยู่ไหน", "Where is it?", ["Where's it?"]),
    ])
    say["fnd_v7_u14n04"] = say_it_pool("fnd_v7_u14n04", [
        ("เห็นของอยู่ไกล ๆ แต่ยังไม่รู้ว่าคืออะไร", "What is that?", ["What's that?"]),
        ("เห็นผู้หญิงคนหนึ่งแต่ยังไม่รู้ว่าเป็นใคร", "Who is she?", []),
        ("หาไม่เจอกระเป๋าของตัวเอง", "Where is my bag?", ["Where's my bag?"]),
        ("มีของอยู่ใกล้ ๆ แต่ยังไม่รู้ว่าคืออะไร", "What is this?", ["What's this?"]),
        ("อยากรู้ว่า Max อยู่ที่ไหน", "Where is Max?", ["Where's Max?"]),
    ])
    say["fnd_v7_u14tn02"] = say_it_pool("fnd_v7_u14tn02", [
        ("ยังไม่รู้ว่าคลาสเรียนวันไหน", "When is the class?", []),
        ("รู้วันแล้ว แต่ยังไม่รู้ว่ากี่โมง", "What time is the class?", []),
        ("ยังไม่รู้ว่าคลาสเรียนที่ไหน", "Where is the class?", []),
        ("อีกคลาสหนึ่ง รู้วันแล้ว แต่ยังไม่รู้เวลานาฬิกา", "What time is the class?", []),
        ("อีกคลาสหนึ่ง ยังไม่รู้วัน", "When is the class?", []),
    ])
    say["fnd_v7_u14tn05"] = say_it_pool("fnd_v7_u14tn05", [
        ("วันเกิดสมมติอยู่ในเดือน January", "My birthday is in January.", ["My birthday is in January"]),
        ("วันเกิดสมมติอยู่ในเดือน February", "My birthday is in February.", []),
        ("คลาสอยู่ในเดือน March", "The class is in March.", []),
        ("คลาสเรียนวัน Friday", "The class is on Friday.", []),
        ("คลาสเริ่มตอนสิบโมง", "The class is at ten.", ["The class is at 10."]),
    ])
    say["fnd_v7_u14tn11"] = say_it_pool("fnd_v7_u14tn11", [
        ("อยากรู้ราคาของสิ่งนั้น", "How much is it?", []),
        ("อยากรู้ราคากระเป๋า", "How much is the bag?", []),
        ("อยากรู้ราคาหนังสือ", "How much is the book?", []),
        ("อยากรู้ราคาตั๋วหนึ่งใบ", "How much is one ticket?", []),
        ("รู้ราคาแล้ว แต่ยังไม่รู้ว่ากระเป๋าอยู่ไหน", "Where is the bag?", ["Where's the bag?"]),
    ])
    say["fnd_v7_u14tn13"] = say_it_pool("fnd_v7_u14tn13", [
        ("วันเกิดสมมติอยู่ในเดือน July", "My birthday is in July.", []),
        ("คลาสอยู่ในเดือน August", "The class is in August.", []),
        ("วันเกิดสมมติอยู่ในเดือน September", "My birthday is in September.", []),
        ("คลาสอยู่ในเดือน May", "The class is in May.", []),
        ("คลาสเรียนวัน Monday", "The class is on Monday.", []),
    ])
    say["fnd_v7_u14tn15"] = say_it_pool("fnd_v7_u14tn15", [
        ("อยากรู้ว่าต้องเอาหนังสือกี่เล่ม", "How many books?", ["How many books"]),
        ("อยากรู้ราคาหนังสือ", "How much is the book?", []),
        ("อยากรู้ว่าต้องซื้อตั๋วกี่ใบ", "How many tickets?", []),
        ("อยากรู้ราคาตั๋วหนึ่งใบ", "How much is one ticket?", []),
        ("อยากรู้ว่าต้องเอาปากกากี่ด้าม", "How many pens?", []),
    ])
    months_all = [
        ("January", "มกราคม"), ("February", "กุมภาพันธ์"), ("March", "มีนาคม"),
        ("April", "เมษายน"), ("May", "พฤษภาคม"), ("June", "มิถุนายน"),
        ("July", "กรกฎาคม"), ("August", "สิงหาคม"), ("September", "กันยายน"),
        ("October", "ตุลาคม"), ("November", "พฤศจิกายน"), ("December", "ธันวาคม"),
    ]
    # First-play friendly: Oct/Nov/Dec + two older — but pool can hold 12; deal takes 5
    remember_items = []
    for mon, th in [
        ("October", "ตุลาคม"), ("November", "พฤศจิกายน"), ("December", "ธันวาคม"),
        ("March", "มีนาคม"), ("May", "พฤษภาคม"), ("January", "มกราคม"),
        ("July", "กรกฎาคม"), ("April", "เมษายน"), ("June", "มิถุนายน"),
        ("February", "กุมภาพันธ์"), ("August", "สิงหาคม"), ("September", "กันยายน"),
    ]:
        if mon in {"October", "November", "December", "July", "August", "September", "January", "February", "March", "April", "May", "June"}:
            frame = "My birthday is in" if mon in {"October", "November", "December", "January", "February", "July", "September"} else "The class is in"
            remember_items.append((f"พูดว่า{('วันเกิด' if 'birthday' in frame else 'คลาส')}อยู่ในเดือน{th}", f"{frame} {mon}.", []))
    say["fnd_v7_u14tn18"] = say_it_pool("fnd_v7_u14tn18", remember_items[:12] if len(remember_items) >= 5 else remember_items)
    # Ensure exactly usable pool >= 5
    if len(say["fnd_v7_u14tn18"]) < 5:
        say["fnd_v7_u14tn18"] = say_it_pool("fnd_v7_u14tn18", [
            ("วันเกิดสมมติอยู่ในเดือน October", "My birthday is in October.", []),
            ("วันเกิดสมมติอยู่ในเดือน November", "My birthday is in November.", []),
            ("วันเกิดสมมติอยู่ในเดือน December", "My birthday is in December.", []),
            ("คลาสอยู่ในเดือน March", "The class is in March.", []),
            ("คลาสอยู่ในเดือน May", "The class is in May.", []),
            ("วันเกิดสมมติอยู่ในเดือน January", "My birthday is in January.", []),
            ("คลาสอยู่ในเดือน July", "The class is in July.", []),
            ("วันเกิดสมมติอยู่ในเดือน April", "My birthday is in April.", []),
        ])
    say["fnd_v7_u14tn20"] = say_it_pool("fnd_v7_u14tn20", [
        ("มีของอยู่ใกล้ ๆ แต่ยังไม่รู้ว่าคืออะไร", "What is this?", ["What's this?"]),
        ("เห็นผู้หญิงคนหนึ่งแต่ยังไม่รู้ว่าเป็นใคร", "Who is she?", []),
        ("หาไม่เจอกระเป๋าของตัวเอง", "Where is my bag?", ["Where's my bag?"]),
        ("ยังไม่รู้ว่าคลาสเรียนวันไหน", "When is the class?", []),
        ("รู้วันแล้ว แต่ยังไม่รู้ว่ากี่โมง", "What time is the class?", []),
        ("อยากรู้ราคาตั๋วหนึ่งใบ", "How much is one ticket?", []),
        ("อยากรู้ว่าต้องเอาหนังสือกี่เล่ม", "How many books?", []),
    ])
    # Update room say_it if missing / replace old
    say["fnd_v7_u15n12"] = say_it_pool("fnd_v7_u15n12", [
        ("ในห้องมีโต๊ะหนึ่งตัว", "There is a table.", ["There's a table."]),
        ("ในห้องมีเก้าอี้สองตัว", "There are two chairs.", []),
        ("ในห้องมีหน้าต่างหนึ่งบาน", "There is a window.", ["There's a window."]),
        ("ในห้องมีหนังสือสามเล่ม", "There are three books.", []),
        ("ในห้องมีกระเป๋าหนึ่งใบ", "There is a bag.", ["There's a bag."]),
    ])
    say["fnd_v7_u15n13"] = say_it_pool("fnd_v7_u15n13", [
        ("หนังสืออยู่ในกระเป๋า", "The book is in the bag.", []),
        ("โทรศัพท์อยู่บนโต๊ะ", "The phone is on the table.", []),
        ("กระเป๋าอยู่ใต้เตียง", "The bag is under the bed.", []),
        ("เก้าอี้อยู่ข้างหน้าต่าง", "The chair is next to the window.", []),
        ("ในห้องมีเก้าอี้สองตัว", "There are two chairs.", []),
    ])
    say["fnd_v7_u15n07"] = say_it_pool("fnd_v7_u15n07", [
        ("บอกให้ตรงไป", "Go straight.", []),
        ("บอกให้เลี้ยวซ้าย", "Turn left.", []),
        ("บอกให้เลี้ยวขวา", "Turn right.", []),
        ("บอกให้ตรงไปแล้วเลี้ยวซ้าย", "Go straight and turn left.", []),
        ("บอกให้ตรงไปแล้วเลี้ยวขวา", "Go straight and turn right.", []),
    ])
    SAY_IT_PATH.write_text(json.dumps(say, ensure_ascii=False, indent=2) + "\n")

    # --- Lesson authoring ---
    lessons = json.loads(LESSON_AUTH.read_text())
    lessons["fnd_v7_what_is_this"] = lesson_auth(
        "What Is This?", "นี่คืออะไร?",
        "ถาม What is this? และ What is that? สำหรับสิ่งของใกล้และไกล",
        "โมเดลใกล้-ไกล; เลือก What/Who สำหรับของ; ยังไม่ถามพหูพจน์",
        [
            ("ของอยู่ใกล้ ๆ ใช้ What is this?", ["What is this?"]),
            ("ของอยู่ไกล ๆ ใช้ What is that?", ["What is that?"]),
        ],
        "มีของอยู่บนโต๊ะใกล้ ๆ แต่ยังไม่รู้ว่าคืออะไร", "What is this?",
    )
    lessons["fnd_v7_who_is_this"] = lesson_auth(
        "Who Is This?", "คนนี้คือใคร?",
        "ถาม Who is this / she / he? เพื่อหาตัวตน",
        "ตอบด้วยตัวตน; ไม่บังคับอาชีพเป็นคำตอบเดียว",
        [
            ("ถามคนใกล้ ๆ ด้วย Who is this?", ["Who is this?"]),
            ("ถามผู้หญิงด้วย Who is she?", ["Who is she?"]),
            ("ถามผู้ชายด้วย Who is he?", ["Who is he?"]),
        ],
        "เห็นผู้หญิงคนหนึ่งแต่ยังไม่รู้ว่าเป็นใคร", "Who is she?",
    )
    lessons["fnd_v7_where_is_my_bag"] = lesson_auth(
        "Where Is My Bag?", "กระเป๋าฉันอยู่ไหน?",
        "ถาม Where is…? เพื่อหาตำแหน่ง",
        "รับ here / there / in Room 2; อธิบาย in Room 2 เป็นชิ้นรับ",
        [
            ("หาไม่เจอกระเป๋า", ["Where is my bag?"]),
            ("หาไม่เจอโทรศัพท์", ["Where is my phone?"]),
            ("อยากรู้ว่า Max อยู่ไหน", ["Where is Max?"]),
        ],
        "หาไม่เจอหนังสือของตัวเอง", "Where is my book?",
    )
    lessons["fnd_v7_what_do_you_want_to_know"] = lesson_auth(
        "What Do You Want to Know?", "อยากรู้อะไร?",
        "เลือก What / Who / Where ตามข้อมูลที่ขาด",
        "ห้าสถานการณ์สั้น แต่ละคำถามได้คำตอบก่อนงานถัดไป",
        [
            ("อยากรู้ว่าผู้ชายคนนั้นเป็นใคร", ["Who is he?"]),
            ("รู้ชื่อ Max แล้ว แต่อยากรู้ว่าเขาอยู่ไหน", ["Where is Max?"]),
            ("มีของที่ไม่รู้จัก", ["What is this?"]),
        ],
        "รู้แล้วว่าเป็นกระเป๋าของตัวเอง แต่ยังไม่รู้ว่าอยู่ไหน", "Where is my bag?",
    )
    lessons["fnd_v7_when_or_what_time"] = lesson_auth(
        "When or What Time?", "When หรือ What Time?",
        "แยก When กับ What time และทบทวน Where",
        "When ใช้ได้กว้างกับวัน/เวลา; ไม่สอนว่า when ถามได้แค่วัน",
        [
            ("ยังไม่รู้วันเรียน", ["When is the class?"]),
            ("รู้วันแล้ว ยังไม่รู้กี่โมง", ["What time is the class?"]),
            ("ยังไม่รู้ห้อง", ["Where is the class?"]),
        ],
        "รู้วันแล้ว แต่ยังไม่รู้เวลานาฬิกา", "What time is the class?",
    )
    lessons["fnd_v7_in_which_month"] = lesson_auth(
        "In Which Month?", "เดือนไหน?",
        "ใช้ in + month สำหรับวันเกิดและคลาส",
        "สอน birthday ในบท; เปรียบ on Friday กับ in March; ไม่บังคับเดือนที่ยังไม่เรียน",
        [
            ("โมเดลวันเกิดใน January", ["My birthday is in January."]),
            ("คลาสใน March", ["The class is in March."]),
            ("ถาม When is your birthday?", ["When is your birthday?"]),
        ],
        "โปรไฟล์สมมติ: วันเกิดอยู่ใน January", "My birthday is in January.",
    )
    lessons["fnd_v7_how_much_is_it"] = lesson_auth(
        "How Much Is It?", "ราคาเท่าไร?",
        "ถามราคาด้วย How much is…?",
        "ราคาเป็นบาทด้วยตัวเลขที่เรียนแล้ว",
        [
            ("ถามราคาทั่วไป", ["How much is it?"]),
            ("ถามราคากระเป๋า", ["How much is the bag?"]),
            ("ถามราคาตั๋วหนึ่งใบ", ["How much is one ticket?"]),
        ],
        "อยากรู้ราคาหนังสือ", "How much is the book?",
    )
    lessons["fnd_v7_how_many"] = lesson_auth(
        "How Many?", "กี่ชิ้น?",
        "ถามจำนวนด้วย How many…?",
        "บริบทขอให้นำ/ซื้อของ; โมเดลพหูพจน์",
        [
            ("ต้องการหนังสือ", ["How many books?"]),
            ("ต้องการตั๋ว", ["How many tickets?"]),
            ("ต้องการปากกา", ["How many pens?"]),
        ],
        "อีกฝ่ายขอให้ช่วยเตรียมหนังสือ แต่ยังไม่บอกจำนวน", "How many books?",
    )
    # Keep old keys for any residual refs; remap titles optional
    LESSON_AUTH.write_text(json.dumps(lessons, ensure_ascii=False, indent=2) + "\n")

    # --- Simulations ---
    sims = json.loads(SIM_AUTH.read_text())
    # Update Plan My Class (preserve id foundation_v7_u14n06)
    for s in sims:
        if s["simulationId"] == "foundation_v7_u14n06":
            s["nodeId"] = "v7_u14tn08"
            s["titleEn"] = "Plan My Class"
            s["scenarioTh"] = "คุณจะมาเรียน แต่ยังไม่รู้วัน เวลา และห้อง ถามวัน ถามกี่โมง แล้วถามห้อง"
            s["openingEn"] = "Hi! Can I help you?"
            s["role"] = (
                "You are the class helper. The class is Friday at ten in Room 2. "
                "Open with exactly 'Hi! Can I help you?' and wait for the learner to ask. "
                "Answer ONLY the fact they asked: if they ask the day (When is the class?), say 'On Friday.' "
                "If they ask the clock time (What time is the class?), say 'At ten.' "
                "If they ask the place (Where is the class?), say 'In Room 2.' "
                "Never combine day+time+place in one answer unless they asked for more than one fact in the same turn. "
                "Never reveal an unasked fact. Accept question order changes and contractions. "
                "Thank you is optional closing, not an information goal. After all three facts are known, close with exactly 'See you on Friday!' "
                "Keep every line short and A1-level. Do not put hint text or coaching in textTh — translate your English only."
            )
            s["goals"] = [
                {
                    "id": "ask_day",
                    "th": "ถามว่าเรียนวันไหน",
                    "en": "Ask which day the class is",
                    "example": "When is the class?",
                    "hints": {
                        "intentTh": "ถามว่าเรียนวันไหน",
                        "starterEn": "When…?",
                        "modelEn": "When is the class?",
                    },
                },
                {
                    "id": "ask_time",
                    "th": "ถามว่าเรียนกี่โมง",
                    "en": "Ask what time the class is",
                    "example": "What time is the class?",
                    "hints": {
                        "intentTh": "ถามว่าเรียนกี่โมง",
                        "starterEn": "What time…?",
                        "modelEn": "What time is the class?",
                    },
                },
                {
                    "id": "ask_place",
                    "th": "ถามว่าเรียนที่ไหน",
                    "en": "Ask where the class is",
                    "example": "Where is the class?",
                    "hints": {
                        "intentTh": "ถามว่าเรียนที่ไหน",
                        "starterEn": "Where…?",
                        "modelEn": "Where is the class?",
                    },
                },
            ]
            s["minTurns"] = 3
            s["maxTurns"] = 6
            s["completionEn"] = "See you on Friday!"
            s["completionTh"] = "แล้วเจอกันวันศุกร์นะครับ!"
        if s["simulationId"] == "foundation_v7_u15n08":
            s["titleEn"] = "Find the Room"
            s["scenarioTh"] = (
                "คุณต้องการหาห้อง 2 และห้องน้ำ และอยากได้กระเป๋าที่ฝากไว้กับเจ้าหน้าที่คนนี้ "
                "ถามทีละอย่าง; กระเป๋าไม่ใช่ของเซอร์ไพรส์ — ภารกิจบอกไว้แล้ว"
            )
            s["openingEn"] = "Hi! Can I help you?"
            s["role"] = (
                "You are school staff. The learner needs Room 2, the bathroom, and their bag left with you. "
                "Open with exactly 'Hi! Can I help you?' "
                "If they ask where Room 2 is, say 'Go straight and turn left.' "
                "If they ask where the bathroom is, say 'It's next to Room 2.' "
                "If they ask where their bag is, say 'It's under the chair.' "
                "Answer only the fact asked. Never require Please say that again or transport steps. "
                "After all three locations are known and they thank you, close with 'You're welcome!' "
                "textTh must faithfully translate aiResponse only — no coaching or next-task hints."
            )
            s["goals"] = [
                {
                    "id": "locate_room",
                    "th": "ถามว่าห้อง 2 อยู่ที่ไหน",
                    "en": "Ask where Room 2 is",
                    "example": "Where is Room 2?",
                    "hints": {
                        "intentTh": "ถามว่าห้อง 2 อยู่ที่ไหน",
                        "starterEn": "Where is Room…?",
                        "modelEn": "Where is Room 2?",
                    },
                },
                {
                    "id": "locate_bathroom",
                    "th": "ถามว่าห้องน้ำอยู่ที่ไหน",
                    "en": "Ask where the bathroom is",
                    "example": "Where is the bathroom?",
                    "hints": {
                        "intentTh": "ถามว่าห้องน้ำอยู่ที่ไหน",
                        "starterEn": "Where is the bathroom…?",
                        "modelEn": "Where is the bathroom?",
                    },
                },
                {
                    "id": "locate_bag",
                    "th": "ถามหากระเป๋าที่ฝากไว้กับเจ้าหน้าที่",
                    "en": "Ask where your bag is",
                    "example": "Where is my bag?",
                    "hints": {
                        "intentTh": "ถามหากระเป๋าที่ฝากไว้กับเจ้าหน้าที่",
                        "starterEn": "Where is my bag…?",
                        "modelEn": "Where is my bag?",
                    },
                },
            ]
            s["minTurns"] = 3
            s["maxTurns"] = 6
            s["completionEn"] = "You're welcome!"
            s["completionTh"] = "ด้วยความยินดีครับ!"

    # Remove Around Town sim from active list? Keep file entry for A2 but path won't reference it.
    # Add Meet Your Teacher + Plan a Movie
    sims = [s for s in sims if s["simulationId"] != "foundation_v7_u16n10"] + [
        {
            "simulationId": "foundation_v7_u14n15",
            "nodeId": "v7_u14n15",
            "titleEn": "Meet Your Teacher",
            "scenarioTh": (
                "คุณมาถึงอาคารเรียนและเห็นรูปครูคนใหม่บนโต๊ะ "
                "ลองถาม Mali ว่าเขาคือใคร อยู่ที่ไหน และห้องนั้นอยู่ตรงไหน"
            ),
            "openingEn": "Hi! Can I help you?",
            "role": (
                "You are Mali, a friendly school receptionist at the front desk. "
                "The learner sees a photo of a man on the counter — Teacher John. "
                "He is in Room 2, which is over there. "
                "Open with exactly 'Hi! Can I help you?' "
                "If they ask who he is / who this is, say 'He's John, your teacher.' "
                "If they ask where John is / where he is / where the teacher is, say 'He's in Room 2.' "
                "If they ask where Room 2 is, say 'It's over there.' "
                "Answer only the fact asked. Accept Who is this? for the photo. "
                "Do not reveal unasked facts. After all three facts and optional Thank you, "
                "close with exactly 'You're welcome!' "
                "textTh translates aiResponse only — never leak the next goal or put coaching in textTh."
            ),
            "goals": [
                {
                    "id": "identify_person",
                    "th": "ถามว่าผู้ชายในรูปคือใคร",
                    "en": "Ask who the man in the photo is",
                    "example": "Who is he?",
                    "hints": {
                        "intentTh": "ถามว่าผู้ชายในรูปคือใคร",
                        "starterEn": "Who is…?",
                        "modelEn": "Who is he?",
                    },
                },
                {
                    "id": "locate_person",
                    "th": "ถามว่าครู John อยู่ที่ไหน",
                    "en": "Ask where Teacher John is",
                    "example": "Where is John?",
                    "hints": {
                        "intentTh": "ถามว่าครู John อยู่ที่ไหน",
                        "starterEn": "Where is John…?",
                        "modelEn": "Where is John?",
                    },
                },
                {
                    "id": "locate_room",
                    "th": "ถามว่าห้อง 2 อยู่ที่ไหน",
                    "en": "Ask where Room 2 is",
                    "example": "Where is Room 2?",
                    "hints": {
                        "intentTh": "ถามว่าห้อง 2 อยู่ที่ไหน",
                        "starterEn": "Where is Room…?",
                        "modelEn": "Where is Room 2?",
                    },
                },
            ],
            "minTurns": 3,
            "maxTurns": 6,
            "completionEn": "You're welcome!",
            "completionTh": "ด้วยความยินดีค่ะ!",
        },
        {
            "simulationId": "foundation_v7_u14tn21",
            "nodeId": "v7_u14tn21",
            "titleEn": "Plan a Movie",
            "scenarioTh": (
                "คุณเลือกหนังแล้วและอยากได้ตั๋วหนึ่งใบ แต่ยังไม่รู้วัน รอบฉาย และราคา "
                "คุยกับ Mali ที่โต๊ะขายตั๋ว"
            ),
            "openingEn": "Hi! Can I help you?",
            "role": (
                "You are Mali at the ticket desk. The movie is on Friday at seven. One ticket is eighty baht. "
                "Open with exactly 'Hi! Can I help you?' "
                "If they ask when the movie is, say 'On Friday.' "
                "If they ask what time, say 'At seven.' "
                "If they ask how much one ticket is, say 'Eighty baht.' "
                "Do not answer day+time+price together unless asked. No route/transport goal. "
                "Do not force How many — they already want one ticket. "
                "Optional closing after goals: if they say One ticket, please or Thank you, reply 'Enjoy the movie!' "
                "Otherwise after three facts close with 'Enjoy the movie!' "
                "textTh translates aiResponse only."
            ),
            "goals": [
                {
                    "id": "ask_day",
                    "th": "ถามว่าหนังฉายวันไหน",
                    "en": "Ask which day the movie is",
                    "example": "When is the movie?",
                    "hints": {
                        "intentTh": "ถามว่าหนังฉายวันไหน",
                        "starterEn": "When…?",
                        "modelEn": "When is the movie?",
                    },
                },
                {
                    "id": "ask_time",
                    "th": "ถามว่าหนังฉายกี่โมง",
                    "en": "Ask what time the movie is",
                    "example": "What time is the movie?",
                    "hints": {
                        "intentTh": "ถามว่าหนังฉายกี่โมง",
                        "starterEn": "What time…?",
                        "modelEn": "What time is the movie?",
                    },
                },
                {
                    "id": "ask_price",
                    "th": "ถามราคาตั๋วหนึ่งใบ",
                    "en": "Ask how much one ticket is",
                    "example": "How much is one ticket?",
                    "hints": {
                        "intentTh": "ถามราคาตั๋วหนึ่งใบ",
                        "starterEn": "How much…?",
                        "modelEn": "How much is one ticket?",
                    },
                },
            ],
            "minTurns": 3,
            "maxTurns": 6,
            "completionEn": "Enjoy the movie!",
            "completionTh": "สนุกกับหนังนะคะ!",
        },
    ]
    # Keep u16n10 in a sidecar for A2? Spec: preserve content/IDs. Re-append archived entry without path ref is fine — keep in authoring for A2.
    archived_u16 = {
        "simulationId": "foundation_v7_u16n10",
        "nodeId": "v7_u16n10",
        "titleEn": "Get to the Station",
        "scenarioTh": "[A2 archive] ไปสถานี — เก็บไว้แมป A2 ภายหลัง ไม่ได้อยู่บน A1 path",
        "openingEn": "Hi! Can I help you?",
        "role": "Archived for A2. Not on the A1 Foundation path.",
        "goals": [
            {"id": "ask_place", "th": "ถามสถานที่", "en": "Ask where", "example": "Where is the station?"},
            {"id": "ask_how", "th": "ถามวิธีไป", "en": "Ask how to go", "example": "How do I go?"},
            {"id": "thank", "th": "ขอบคุณ", "en": "Thank you", "example": "Thank you"},
        ],
        "minTurns": 3,
        "maxTurns": 6,
        "completionEn": "Have a good trip!",
        "completionTh": "เดินทางปลอดภัยนะครับ!",
    }
    # Only add archive if not present
    if not any(s["simulationId"] == "foundation_v7_u16n10" for s in sims):
        sims.append(archived_u16)
    SIM_AUTH.write_text(json.dumps(sims, ensure_ascii=False, indent=2) + "\n")

    # --- Info task pools ---
    def opt(oid, label):
        return {"id": oid, "label": label}

    info_pools = {
        "info_task_calendar_1": {
            "title": "Read the Calendar 1",
            "introTh": "วันที่เขียนแบบ 5 May หมายถึง วันที่ 5 เดือนพฤษภาคม (เลขวัน + ชื่อเดือนภาษาอังกฤษ)",
            "items": [
                {
                    "id": "cal1_01",
                    "sourceMode": "text",
                    "sourceContent": "CLASS · 5 May · 10:00",
                    "taskTh": "เลือกวันที่ของคลาส",
                    "options": [opt("a", "5 May"), opt("b", "10 May"), opt("c", "5 March")],
                    "correctOptionId": "a",
                    "explanationTh": "บัตรเขียน 5 May = วันที่ 5 เดือนพฤษภาคม",
                    "vocabTags": ["May"],
                },
                {
                    "id": "cal1_02",
                    "sourceMode": "text",
                    "sourceContent": "Calendar · June · day 8 highlighted",
                    "taskTh": "เลือกวันที่ที่ไฮไลต์",
                    "options": [opt("a", "8 May"), opt("b", "8 June"), opt("c", "18 June")],
                    "correctOptionId": "b",
                    "explanationTh": "หัวปฏิทินคือ June และวันที่ 8 ถูกไฮไลต์",
                    "vocabTags": ["June"],
                },
                {
                    "id": "cal1_03",
                    "sourceMode": "text",
                    "sourceContent": "CLASS · Friday · 10:00 · Room 2",
                    "taskTh": "เลือกสถานที่เรียน",
                    "options": [opt("a", "Friday"), opt("b", "10:00"), opt("c", "Room 2")],
                    "correctOptionId": "c",
                    "explanationTh": "Room 2 คือสถานที่",
                    "vocabTags": ["Room 2"],
                },
                {
                    "id": "cal1_04",
                    "sourceMode": "text",
                    "sourceContent": "Birthday · 3 March",
                    "taskTh": "เลือกเดือนของวันเกิด",
                    "options": [opt("a", "March"), opt("b", "May"), opt("c", "3")],
                    "correctOptionId": "a",
                    "explanationTh": "March คือเดือน",
                    "vocabTags": ["March"],
                },
                {
                    "id": "cal1_05",
                    "sourceMode": "text",
                    "sourceContent": "CLASS · 9 April · 7:00",
                    "taskTh": "เลือกเวลาของคลาส",
                    "options": [opt("a", "9 April"), opt("b", "7:00"), opt("c", "9:00")],
                    "correctOptionId": "b",
                    "explanationTh": "7:00 คือเวลา",
                    "vocabTags": ["April"],
                },
            ],
        },
        "info_task_calendar_2": {
            "title": "Read the Calendar 2",
            "introTh": "อ่านวันที่ เวลา และห้อง จากบัตรที่มีเดือนหลัง ๆ ด้วย",
            "items": [
                {
                    "id": "cal2_01",
                    "sourceMode": "text",
                    "sourceContent": "CLASS · 12 October · 9:00 · Room 3",
                    "taskTh": "เลือกวันที่",
                    "options": [opt("a", "12 October"), opt("b", "9:00"), opt("c", "Room 3")],
                    "correctOptionId": "a",
                    "explanationTh": "12 October คือวันที่",
                    "vocabTags": ["October"],
                },
                {
                    "id": "cal2_02",
                    "sourceMode": "text",
                    "sourceContent": "CLASS · 12 October · 9:00 · Room 3",
                    "taskTh": "เลือกเวลา",
                    "options": [opt("a", "12 October"), opt("b", "9:00"), opt("c", "Room 3")],
                    "correctOptionId": "b",
                    "explanationTh": "9:00 คือเวลา",
                    "vocabTags": ["October"],
                },
                {
                    "id": "cal2_03",
                    "sourceMode": "text",
                    "sourceContent": "MEETING · 4 November · Room 1",
                    "taskTh": "เลือกเดือน",
                    "options": [opt("a", "November"), opt("b", "October"), opt("c", "Room 1")],
                    "correctOptionId": "a",
                    "explanationTh": "November คือเดือน",
                    "vocabTags": ["November"],
                },
                {
                    "id": "cal2_04",
                    "sourceMode": "text",
                    "sourceContent": "PARTY · 20 December · 6:00",
                    "taskTh": "เลือกวันที่",
                    "options": [opt("a", "20 December"), opt("b", "6 December"), opt("c", "20 November")],
                    "correctOptionId": "a",
                    "explanationTh": "20 December คือวันที่",
                    "vocabTags": ["December"],
                },
                {
                    "id": "cal2_05",
                    "sourceMode": "text",
                    "sourceContent": "CLASS · 5 May · 10:00 · Room 2",
                    "taskTh": "เลือกห้อง",
                    "options": [opt("a", "5 May"), opt("b", "10:00"), opt("c", "Room 2")],
                    "correctOptionId": "c",
                    "explanationTh": "Room 2 คือห้อง",
                    "vocabTags": ["May"],
                },
            ],
        },
        "info_task_ticket": {
            "title": "Read My Ticket",
            "introTh": "อ่านบัตรสั้นแล้วเลือกข้อมูลที่ถาม — หนึ่งฟิลด์ต่อข้อ",
            "items": [
                {
                    "id": "tix_01",
                    "sourceMode": "text",
                    "sourceContent": "MOVIE · Friday · 7:00 · 80 baht",
                    "taskTh": "หนังฉายกี่โมง?",
                    "options": [opt("a", "Friday"), opt("b", "7:00"), opt("c", "80 baht")],
                    "correctOptionId": "b",
                    "explanationTh": "7:00 คือเวลา",
                    "vocabTags": ["Friday"],
                },
                {
                    "id": "tix_02",
                    "sourceMode": "text",
                    "sourceContent": "2 tickets · 80 baht each",
                    "taskTh": "ตั๋วกี่ใบ?",
                    "options": [opt("a", "2"), opt("b", "80"), opt("c", "8")],
                    "correctOptionId": "a",
                    "explanationTh": "2 tickets คือจำนวน",
                    "vocabTags": ["ticket"],
                },
                {
                    "id": "tix_03",
                    "sourceMode": "text",
                    "sourceContent": "CLASS · Monday · Room 2",
                    "taskTh": "เรียนที่ไหน?",
                    "options": [opt("a", "Monday"), opt("b", "Room 2"), opt("c", "Class")],
                    "correctOptionId": "b",
                    "explanationTh": "Room 2 คือสถานที่",
                    "vocabTags": ["Room 2"],
                },
                {
                    "id": "tix_04",
                    "sourceMode": "text",
                    "sourceContent": "MOVIE · Saturday · 6:00 · 50 baht",
                    "taskTh": "ตั๋วหนึ่งใบราคาเท่าไร?",
                    "options": [opt("a", "50 baht"), opt("b", "6:00"), opt("c", "Saturday")],
                    "correctOptionId": "a",
                    "explanationTh": "50 baht คือราคา",
                    "vocabTags": ["baht"],
                },
                {
                    "id": "tix_05",
                    "sourceMode": "text",
                    "sourceContent": "CLASS · 5 May · 10:00",
                    "taskTh": "คลาสวันไหน (วันที่)?",
                    "options": [opt("a", "5 May"), opt("b", "10:00"), opt("c", "May 50")],
                    "correctOptionId": "a",
                    "explanationTh": "5 May คือวันที่",
                    "vocabTags": ["May"],
                },
            ],
        },
        "info_task_listen_find": {
            "title": "Listen & Find",
            "introTh": "ฟังแล้วเลือกภาพหรือเส้นทางที่ตรง — ยังไม่แสดงบทถอดเสียงโดยค่าเริ่มต้น",
            "items": [
                {
                    "id": "lf_01",
                    "sourceMode": "audio",
                    "sourceContent": "The bag is under the chair.",
                    "transcriptEn": "The bag is under the chair.",
                    "taskTh": "เลือกฉากที่ตรงกับที่ได้ยิน",
                    "options": [opt("a", "Bag under chair"), opt("b", "Bag on table"), opt("c", "Bag in bag")],
                    "correctOptionId": "a",
                    "explanationTh": "under the chair = ใต้เก้าอี้",
                    "vocabTags": ["under", "chair"],
                },
                {
                    "id": "lf_02",
                    "sourceMode": "audio",
                    "sourceContent": "The phone is on the table.",
                    "transcriptEn": "The phone is on the table.",
                    "taskTh": "เลือกฉากที่ตรงกับที่ได้ยิน",
                    "options": [opt("a", "Phone under bed"), opt("b", "Phone on table"), opt("c", "Phone in bag")],
                    "correctOptionId": "b",
                    "explanationTh": "on the table = บนโต๊ะ",
                    "vocabTags": ["on", "table"],
                },
                {
                    "id": "lf_03",
                    "sourceMode": "audio",
                    "sourceContent": "The book is in the bag.",
                    "transcriptEn": "The book is in the bag.",
                    "taskTh": "เลือกฉากที่ตรงกับที่ได้ยิน",
                    "options": [opt("a", "Book on bed"), opt("b", "Book under chair"), opt("c", "Book in bag")],
                    "correctOptionId": "c",
                    "explanationTh": "in the bag = ในกระเป๋า",
                    "vocabTags": ["in", "bag"],
                },
                {
                    "id": "lf_04",
                    "sourceMode": "audio",
                    "sourceContent": "The chair is next to the bed.",
                    "transcriptEn": "The chair is next to the bed.",
                    "taskTh": "เลือกฉากที่ตรงกับที่ได้ยิน",
                    "options": [opt("a", "Chair next to bed"), opt("b", "Chair under bed"), opt("c", "Chair on bed")],
                    "correctOptionId": "a",
                    "explanationTh": "next to the bed = ข้างเตียง",
                    "vocabTags": ["next to", "bed"],
                },
                {
                    "id": "lf_05",
                    "sourceMode": "audio",
                    "sourceContent": "There are two chairs.",
                    "transcriptEn": "There are two chairs.",
                    "taskTh": "เลือกจำนวนที่ถูกต้อง",
                    "options": [opt("a", "1 chair"), opt("b", "2 chairs"), opt("c", "3 chairs")],
                    "correctOptionId": "b",
                    "explanationTh": "two chairs = สองตัว",
                    "vocabTags": ["There are"],
                },
                {
                    "id": "lf_06",
                    "sourceMode": "audio",
                    "sourceContent": "Go straight and turn left.",
                    "transcriptEn": "Go straight and turn left.",
                    "taskTh": "เลือกลำดับลูกศรที่ถูกต้อง",
                    "options": [opt("a", "Straight then left"), opt("b", "Straight then right"), opt("c", "Left then straight")],
                    "correctOptionId": "a",
                    "explanationTh": "ตรงไปแล้วเลี้ยวซ้าย",
                    "vocabTags": ["Go straight", "Turn left"],
                },
                {
                    "id": "lf_07",
                    "sourceMode": "audio",
                    "sourceContent": "Go straight and turn right.",
                    "transcriptEn": "Go straight and turn right.",
                    "taskTh": "เลือกลำดับลูกศรที่ถูกต้อง",
                    "options": [opt("a", "Straight then left"), opt("b", "Straight then right"), opt("c", "Right only")],
                    "correctOptionId": "b",
                    "explanationTh": "ตรงไปแล้วเลี้ยวขวา",
                    "vocabTags": ["Go straight", "Turn right"],
                },
                {
                    "id": "lf_08",
                    "sourceMode": "audio",
                    "sourceContent": "The bag is next to the door.",
                    "transcriptEn": "The bag is next to the door.",
                    "taskTh": "เลือกฉากที่ตรงกับที่ได้ยิน",
                    "options": [opt("a", "Bag under chair"), opt("b", "Bag next to door"), opt("c", "Bag on table")],
                    "correctOptionId": "b",
                    "explanationTh": "next to the door = ข้างประตู",
                    "vocabTags": ["next to", "door"],
                },
            ],
        },
    }
    INFO_TASK_PATH.write_text(json.dumps(info_pools, ensure_ascii=False, indent=2) + "\n")

    # Migration TS
    MIGRATION_PATH.write_text(
        """/** Legacy → successor node IDs for Ch14–16 revamp. Unmapped legacy IDs stay recorded but do not auto-complete new siblings. */
export const FOUNDATION_V7_NODE_MIGRATION: Record<string, string | null> = {
  // Old Ch14 combined question chapter
  v7_u14n07: 'v7_u14n07', // What&Who (pool slimmed)
  v7_u14n01: 'v7_u14n01', // What Is This (closest to What or Who?)
  v7_u14n02: null, // empty describe_it removed
  v7_u14n08: 'v7_u14n08', // Where/Here/There (was Question Clues 2)
  v7_u14n03: 'v7_u14tn01', // When or What Time only — NOT price/quantity siblings
  v7_u14n04: 'v7_u14n04',
  v7_u14n05: null, // empty describe_it removed
  v7_u14n06: 'v7_u14tn08', // You Ask First → Plan My Class (same simulation id)

  // Old Ch15 Things & Places → displayed Ch16 (same chapter id v7_u15)
  v7_u15n10: 'v7_u15n10',
  v7_u15n01: 'v7_u15n01',
  v7_u15n02: null, // old emoji around-room dropped from path order
  v7_u15n11: 'v7_u15n11',
  v7_u15n12: 'v7_u15n12',
  v7_u15n03: 'v7_u15n03',
  v7_u15n04: 'v7_u15n04',
  v7_u15n05: 'v7_u15n05',
  v7_u15n06: 'v7_u15n06',
  v7_u15n09: 'v7_u15n09',
  v7_u15n07: 'v7_u15n07',
  v7_u15n08: 'v7_u15n08',

  // Around Town removed from A1 — keep completions recorded, no A1 successor
  v7_u16n01: null,
  v7_u16n02: null,
  v7_u16n03: null,
  v7_u16n04: null,
  v7_u16n05: null,
  v7_u16n06: null,
  v7_u16n07: null,
  v7_u16n08: null,
  v7_u16n09: null,
  v7_u16n10: null,
};

export function migrateFoundationV7NodeId(nodeId: string): string | null | undefined {
  if (nodeId in FOUNDATION_V7_NODE_MIGRATION) {
    return FOUNDATION_V7_NODE_MIGRATION[nodeId];
  }
  return undefined;
}
"""
    )
    print("wrote migration + content pools")


if __name__ == "__main__":
    main()
