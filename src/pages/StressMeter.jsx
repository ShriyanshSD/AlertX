import { useEffect, useMemo, useState } from 'react';
import { Activity, HeartPulse, Info, Pause, Play, Sparkles, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '../components/UI.jsx';
import { calculateStressScore, getStressLevel } from '../services/stressAssessment.js';

const questions = [
  { id: 'scared', text: 'Are you feeling scared?' },
  { id: 'confused', text: 'Are you feeling confused?' },
  { id: 'overwhelmed', text: 'Are you feeling overwhelmed?' },
  { id: 'focus', text: 'Are you able to focus?' },
  { id: 'tense', text: 'Are you feeling physically tense?' },
];
const answers = ['No', 'Sometimes', 'Yes'];
const phases = [
  { name: 'Breathe in', seconds: 4, key: 'inhale' },
  { name: 'Hold gently', seconds: 2, key: 'hold' },
  { name: 'Breathe out', seconds: 6, key: 'exhale' },
];

function getAssessment(score) {
  const level = getStressLevel(score);
  if (level === 'low') return {
    label: 'Low stress',
    tone: 'green',
    message: 'Your answers suggest a lower level of stress right now. Keep taking things at your own pace.',
  };
  if (level === 'moderate') return {
    label: 'Moderate stress',
    tone: 'orange',
    message: 'You may find a short breathing or grounding pause helpful. Consider checking in with someone you trust.',
  };
  return {
    label: 'High stress',
    tone: 'red',
    message: 'Your answers suggest you may be feeling very stressed. Reach out to someone you trust. If you are in danger, seek emergency help now.',
  };
}

export default function StressMeter() {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [assessment, setAssessment] = useState(null);
  const [breathing, setBreathing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!breathing) return undefined;
    const timer = window.setInterval(() => setElapsed((current) => (current + 1) % 12), 1000);
    return () => window.clearInterval(timer);
  }, [breathing]);

  const phaseIndex = elapsed < 4 ? 0 : elapsed < 6 ? 1 : 2;
  const phaseStart = phaseIndex === 0 ? 0 : phaseIndex === 1 ? 4 : 6;
  const phase = phases[phaseIndex];
  const secondsRemaining = phase.seconds - (elapsed - phaseStart);
  const unanswered = questions.some((question) => selectedAnswers[question.id] === undefined);
  const score = useMemo(() => {
    if (unanswered) return 0;
    return calculateStressScore(selectedAnswers);
  }, [selectedAnswers, unanswered]);

  const calculateAssessment = () => {
    if (unanswered) return;
    setAssessment(getAssessment(score));
  };

  const toggleBreathing = () => {
    if (breathing) {
      setBreathing(false);
      setElapsed(0);
      return;
    }
    setElapsed(0);
    setBreathing(true);
  };

  return <>
    <SectionHeading eyebrow="WELLBEING CHECK-IN" title="Stress meter" description="A brief self-reflection, not a medical assessment or diagnosis." action={<span className="demo-pill"><HeartPulse size={13} /> PRIVATE · NOT SAVED</span>} />
    <div className="stress-layout">
      <section className="panel stress-card">
        <div className="stress-card-icon"><HeartPulse size={22} /></div>
        <span className="eyebrow">A MOMENT FOR YOU</span>
        <h2>How are you feeling right now?</h2>
        <p className="muted">Choose one answer for each statement. Your answers stay in this page and are not sent to the server.</p>
        <div className="stress-questions">
          {questions.map((question, index) => <fieldset className="stress-question" key={question.id}>
            <legend><span>{index + 1}</span>{question.text}</legend>
            <div className="stress-answer-options">
              {answers.map((answer, answerIndex) => <button
                type="button"
                key={answer}
                aria-pressed={selectedAnswers[question.id] === answerIndex}
                className={selectedAnswers[question.id] === answerIndex ? 'selected' : ''}
                onClick={() => {
                  setSelectedAnswers((current) => ({ ...current, [question.id]: answerIndex }));
                  setAssessment(null);
                }}
              >{answer}</button>)}
            </div>
          </fieldset>)}
        </div>
        <button className="button primary full" type="button" onClick={calculateAssessment} disabled={unanswered}>See my check-in</button>
        {unanswered && <small className="stress-hint">Answer all five statements to calculate the check-in.</small>}
        {assessment && <div className={`stress-meter-display ${assessment.tone} stress-result`} aria-live="polite">
          <div className="meter-number">{score}<small>/ 10</small></div>
          <div><strong>{assessment.label}</strong><span>{assessment.message}</span></div>
        </div>}
        {assessment && <div className="stress-suggestions">
          <h3>Small next steps</h3>
          <p><Sparkles size={14} /> Try a slow, comfortable exhale or name five things you can see around you.</p>
          <p><UserRound size={14} /> Consider calling or messaging someone you trust.</p>
          <p><Info size={14} /> If there is immediate danger, skip this check-in and get emergency help now.</p>
          <Link to="/contacts" className="panel-link">View trusted contacts</Link>
        </div>}
        <small className="stress-disclaimer"><Info size={13} /> Transparent score: symptoms score No=0, Sometimes=1, Yes=2; focus is reverse-scored. 0–3 low, 4–6 moderate, 7–10 high. Not clinically validated.</small>
      </section>
      <aside className="stress-aside">
        <section className="stress-aside-art"><div className="stress-wave"><Activity size={25} /></div><span className="eyebrow">BREATHING PAUSE</span><h2>Take one<br />comfortable breath.</h2><p>Stop at any time. If focusing on breathing feels uncomfortable, return to your normal breathing.</p></section>
        <section className="panel breathing-panel">
          <div className="breathing-orb-wrap">
            <div className={`breathing-orb ${breathing ? phase.key : ''}`} style={{ transitionDuration: breathing ? `${phase.seconds}s` : '0.5s' }}>
              <span>{breathing ? secondsRemaining : <Activity size={22} />}</span>
            </div>
          </div>
          <strong className="breathing-phase">{breathing ? phase.name : 'Ready when you are'}</strong>
          <small>4 seconds in · 2 hold · 6 seconds out</small>
          <button type="button" className={`button ${breathing ? 'secondary' : 'primary'} full`} onClick={toggleBreathing}>
            {breathing ? <Pause size={15} /> : <Play size={15} />}{breathing ? 'Stop exercise' : 'Start breathing exercise'}
          </button>
        </section>
        <section className="assistant-safety"><Info size={17} /><div><strong>Not a diagnosis</strong><p>This check-in is a simple reflection tool, not a clinically validated measure or medical advice.</p></div></section>
      </aside>
    </div>
  </>;
}
