const questionIds = ['scared', 'confused', 'overwhelmed', 'focus', 'tense'];

export function calculateStressScore(answers) {
  if (questionIds.some((id) => !Number.isInteger(answers[id]) || answers[id] < 0 || answers[id] > 2)) {
    throw new Error('Answer all five check-in questions to calculate a score.');
  }
  return questionIds.reduce((score, id) => score + (id === 'focus' ? 2 - answers[id] : answers[id]), 0);
}

export function getStressLevel(score) {
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    throw new Error('Stress check-in scores must be between 0 and 10.');
  }
  if (score <= 3) return 'low';
  if (score <= 6) return 'moderate';
  return 'high';
}
