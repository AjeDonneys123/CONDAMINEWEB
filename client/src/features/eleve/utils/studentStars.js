export const STUDENT_STARS_EVENT = 'condaweb:student-stars-updated';

export async function awardStudentStars(user, { category, points }) {
  const studentId = String(user?._id || user?.id || '').trim();
  if (!studentId || user?.isVisitorPreview === true) return null;
  try {
    const response = await fetch('/api/eleve/auth/star-rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, category, points })
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STUDENT_STARS_EVENT, { detail: result }));
    }
    return result;
  } catch (_) {
    return null;
  }
}
