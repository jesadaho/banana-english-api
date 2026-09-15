/** Previous positional IDs → readable slugs from the lesson title. */
export const FOUNDATION_V7_LESSON_ID_ALIASES: Record<string, string> = {
  'fnd_v7_u02n01': 'fnd_v7_please_and_thank_you',
  'fnd_v7_u02n03': 'fnd_v7_say_that_again',
  'fnd_v7_u03n01': 'fnd_v7_i_am_you_are',
  'fnd_v7_u03n03': 'fnd_v7_not_and_are_you',
  'fnd_v7_u04n01': 'fnd_v7_he_she_it_we_they',
  'fnd_v7_u04n03': 'fnd_v7_my_family',
  'fnd_v7_u05n01': 'fnd_v7_one_or_more',
  'fnd_v7_u06n01': 'fnd_v7_this_is_that_is',
  'fnd_v7_u06n03': 'fnd_v7_colours_and_size',
  'fnd_v7_u06n05': 'fnd_v7_these_and_those',
  'fnd_v7_u07n01': 'fnd_v7_my_and_your',
  'fnd_v7_u07n03': 'fnd_v7_his_her_our_their',
  'fnd_v7_u07n05': 'fnd_v7_have_and_has',
  'fnd_v7_u08n01': 'fnd_v7_numbers_0_10',
  'fnd_v7_u08n03': 'fnd_v7_eleven_to_twenty',
  'fnd_v7_u08n05': 'fnd_v7_letter_names_a_m',
  'fnd_v7_u08n07': 'fnd_v7_letter_names_n_z',
  'fnd_v7_u09n01': 'fnd_v7_twenty_to_one_hundred',
  'fnd_v7_u09n03': 'fnd_v7_what_time_is_it',
  'fnd_v7_u09n05': 'fnd_v7_days_and_simple_plans',
  'fnd_v7_u09n07': 'fnd_v7_prices_and_paying',
  'fnd_v7_u10n01': 'fnd_v7_i_like_i_dont_like',
  'fnd_v7_u10n03': 'fnd_v7_do_you_like_it',
  'fnd_v7_u10n05': 'fnd_v7_want_need_and_please',
  'fnd_v7_u11n01': 'fnd_v7_i_can',
  'fnd_v7_u11n03': 'fnd_v7_cant_and_can_you',
  'fnd_v7_u12n01': 'fnd_v7_my_day',
  'fnd_v7_u12n03': 'fnd_v7_her_day_his_day',
  'fnd_v7_u12n05': 'fnd_v7_do_does_every_day',
  'fnd_v7_u13n01': 'fnd_v7_happening_now',
  'fnd_v7_u13n03': 'fnd_v7_are_they_working',
  'fnd_v7_u14n01': 'fnd_v7_what_or_who',
  'fnd_v7_u14n03': 'fnd_v7_where_when_how_much_and_how_many',
  'fnd_v7_u15n01': 'fnd_v7_there_is_there_are',
  'fnd_v7_u15n03': 'fnd_v7_in_on_under_next_to',
  'fnd_v7_u15n06': 'fnd_v7_go_straight_turn_left',
};

export function canonicalFoundationV7LessonId(lessonId: string): string {
  return FOUNDATION_V7_LESSON_ID_ALIASES[lessonId] ?? lessonId;
}

export function foundationV7LessonLegacyIds(lessonId: string): string[] {
  return Object.entries(FOUNDATION_V7_LESSON_ID_ALIASES)
    .filter(([, canonical]) => canonical === lessonId)
    .map(([legacy]) => legacy);
}
