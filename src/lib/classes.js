/**
 * CENTRAL CLASS CONFIGURATION
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the single source of truth for all class/group options in the app.
 *
 * ┌── SECTION 1: Regular Grade Classes (Grade 7–12) ──────────────────────────
 *    Standard Sunday School academic grades. Support yearly grade promotion.
 *
 * ┌── SECTION 2: Mezmur (Choir) Family Classes ────────────────────────────────
 *    Choir members organized by family group, imported from Attendance_Import_Ready.csv.
 *    These do NOT participate in grade promotion.
 */

export const GRADE_CLASSES = [
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];

export const MEZMUR_CLASSES = [
  'ቅዱስ ኤፍሬም',
  'ማርያም እህተሙሴ',
  'ቅዱስዳዊት',
  'አብርሃም',
  'አባጊዮርጊስዘጋስጫ',
  'ቅዱስባስልዮስ',
  'እዝራ',
  'ቅዱስ ያሬድ',
];

/** All classes combined (grades first, then Mezmur groups) */
export const ALL_CLASSES = [...GRADE_CLASSES, ...MEZMUR_CLASSES];

/**
 * Returns true if the given class string is a Mezmur/choir family group
 * (i.e. it should NOT be promoted during yearly grade promotion).
 */
export function isMezmurClass(className) {
  return MEZMUR_CLASSES.includes(className);
}

/**
 * Returns true if the given class string is a standard academic grade.
 */
export function isGradeClass(className) {
  return GRADE_CLASSES.includes(className);
}
