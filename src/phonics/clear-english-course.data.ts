import { getLesson } from '../lessons/lessons.data';
import { PHONICS_LESSON_SPECS } from './phonics-lessons.data';

const chapters = [
  {title:'Unlock the Sound Code', titleTh:'เริ่มอ่านจากเสียง', legacy:false, ids:PHONICS_LESSON_SPECS.filter(s => s.chapter === 1).map(s => s.lessonId)},
  {title:'Patterns That Travel', titleTh:'อ่านคำใหม่ด้วยรูปสะกดที่คุ้นเคย', legacy:false, ids:PHONICS_LESSON_SPECS.filter(s => s.chapter === 2).map(s => s.lessonId)},
  {title:'Clear Sounds for Thai Speakers', titleTh:'ออกเสียงให้ชัด', legacy:true, previousTitle:'Speak Clearly', ids:['pron_th_1','pron_th_2','pron_w_1','pron_v_1','pron_rl_1','pron_end_t_1','pron_end_d_1','pron_review_1']},
  {title:'Clean Word Endings', titleTh:'จบคำให้ครบ', legacy:true, previousTitle:'Break the Habit', ids:['pron_no_add_1','pron_end_l_1','pron_no_drop_1','pron_final_s_1','pron_tricky_1','pron_silent_1','pron_ed_1','pron_review_2']},
  {title:'Tune Your Vowels', titleTh:'ฝึกเสียงสระ', legacy:true, previousTitle:'Fine-tune Your Sounds', ids:['pron_short_i_1','pron_short_u_1','pron_e_a_1','pron_o_1','pron_diph_1','pron_review_5']},
  {title:'Find the Beat', titleTh:'จับจังหวะการพูด', legacy:true, previousTitle:'Stress & Rhythm', ids:['pron_stress_1','pron_stress_2','pron_sent_stress_1','pron_weak_1','pron_rhythm_1','pron_review_3']},
  {title:'Speak in Smooth Chunks', titleTh:'พูดเชื่อมกันอย่างเป็นธรรมชาติ', legacy:true, previousTitle:'Speak Smoothly', ids:['pron_link_1','pron_link_2','pron_reduce_1','pron_natural_1','pron_flow_1','pron_review_4']},
];

export const CLEAR_ENGLISH_LESSON_IDS = chapters.flatMap(ch => ch.ids);

/** No old quiz scores are converted into completion of newly authored lessons. */
export function buildClearEnglishCourse(completedIds: ReadonlySet<string> = new Set()) {
  const completedNodeIds = CLEAR_ENGLISH_LESSON_IDS.filter(id => completedIds.has(id));
  return {
    courseId:'clear_english', version:'2.0.0-lesson-playtest', status:'playtest',
    chapterCount:7, nodeCount:54, newLessonCount:20, legacyLessonCount:34,
    navigationPolicy:'recommended_order_not_locked',
    progress:{completedNodeIds, completedCount:completedNodeIds.length, totalCount:54, currentNodeId:CLEAR_ENGLISH_LESSON_IDS.find(id => !completedIds.has(id)) ?? null},
    releaseChecks:{frontendSymbolRendering:'not_verified', isolatedPhonemeAudio:'not_available', liveVoicePlaytest:'pending'},
    chapters:chapters.map((chapter,index) => ({
      id:`clear_english_ch${index+1}`, chapter:index+1, title:chapter.title, titleTh:chapter.titleTh,
      previousTitle:chapter.previousTitle, legacy:chapter.legacy,
      nodes:chapter.ids.map((id,order) => {
        const lesson = getLesson(id);
        if (!lesson) throw new Error(`Clear English lesson missing: ${id}`);
        return {
          id, lessonId:id, title:lesson.titleEn, titleTh:lesson.titleTh,
          goal:lesson.goalEn, goalTh:lesson.goalTh, type:'lesson', sessionType:'training',
          mechanic:'listen_model_speak_read', legacy:chapter.legacy,
          completed:completedIds.has(id), comingSoon:false, backendReady:true,
          assessmentMode:chapter.legacy ? 'existing_lesson_completion' : 'participation_only',
          estimatedMinutes:[lesson.estimatedMinutesMin,lesson.estimatedMinutesMax],
          prereqs:[], recommendedAfterLessonId:order > 0 ? chapter.ids[order-1] : index === 1 ? chapters[0].ids[9] : null,
          startRequest:{sessionType:'training',lessonId:id},
          ...(chapter.legacy ? {} : {visualSupport:'emojiChoice_letters', audioMode:'whole_word_tts_unverified'}),
        };
      }),
    })),
  };
}
