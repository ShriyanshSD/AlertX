import { useEffect, useState } from 'react';
import { Activity, HeartPulse, Info, LoaderCircle, Pause, Play, Sparkles, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '../components/UI.jsx';
import api, { getApiError } from '../services/api.js';

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

const assessmentByLevel = {
  low: {
    label: 'Lower stress signals',
    tone: 'green',
    message: 'Your selected answers suggest fewer signs of stress right now. This is only an AI reflection, not a clinical measure.',
  },
  moderate: {
    label: 'Some stress signals',
    tone: 'orange',
    message: 'Your selected answers suggest a mix of stress signals. A pause or a check-in with someone you trust may help.',
  },
  high: {
    label: 'More stress signals',
    tone: 'red',
    message: 'Your selected answers suggest several stress signals. Consider reaching out to someone you trust or a qualified professional.',
  },
}

export default function StressMeter() {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [assessment, setAssessment] = useState(null);
  const [consentToGemini, setConsentToGemini] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  const calculateAssessment = async () => {
    if (unanswered || !consentToGemini || loading) return;
    setAssessment(null);
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/ai/stress-assessment', {
        answers: selectedAnswers,
        consentToGemini: true,
      }, { timeout: 30000 });
      setAssessment(data.data);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
      setConsentToGemini(false);
    }
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
    <SectionHeading eyebrow="GEMINI WELLBEING REFLECTION" title="AI stress check-in" description="Gemini estimates a broad stress signal from your selected answers. This is not a diagnosis or clinical screening." action={<span className="demo-pill"><HeartPulse size={13} /> ONE-TIME · NOT SAVED BY ALERTX</span>} />
    <div className="stress-layout">
      <section className="panel stress-card">
        <div className="stress-card-icon"><HeartPulse size={22} /></div>
        <span className="eyebrow">A PRIVATE, ONE-TIME CHECK-IN</span>
        <h2>How have you been feeling?</h2>
        <p className="muted">Choose the answer that feels closest for each statement. Gemini will consider these five selections only; the result may be inaccurate.</p>
        <div className="stress-questions">
          {questions.map((question, index) => <fieldset className="stress-question" key={question.id}>
            <legend><span>{index + 1}</span>{question.text}</legend>
            <div className="stress-answer-options">
              {answers.map((answer, answerIndex) => <button
                type="button"
                key={answer}
                disabled={loading}
                aria-pressed={selectedAnswers[question.id] === answerIndex}
                className={selectedAnswers[question.id] === answerIndex ? 'selected' : ''}
                onClick={() => {
                  setSelectedAnswers((current) => ({ ...current, [question.id]: answerIndex }));
                  setAssessment(null);
                  setConsentToGemini(false);
                  setError('');
                }}
              >{answer}</button>)}
            </div>
          </fieldset>)}
        </div>
        <div className="stress-ai-privacy">
          <strong>Before you continue</strong>
          <p>Your five selected answers will be sent to Google Gemini for this check-in. AlertX does not save the answers or result, and the Gemini request does not include your name, account details, chat history, or free-text notes. Google’s data-processing policies apply.</p>
          <label className="stress-consent">
            <input
              type="checkbox"
              checked={consentToGemini}
              disabled={loading}
              onChange={(event) => {
                setConsentToGemini(event.target.checked);
                setAssessment(null);
                setError('');
              }}
            />
            <span>I agree to send these answers to Google Gemini for a one-time reflection.</span>
          </label>
        </div>
        <button className="button primary full" type="button" onClick={calculateAssessment} disabled={unanswered || !consentToGemini || loading}>
          {loading ? <><LoaderCircle size={15} className="spinner-icon" /> Asking Gemini…</> : <><Sparkles size={15} /> Analyze my answers</>}
        </button>
        {unanswered && <small className="stress-hint">Answer all five statements to calculate the check-in.</small>}
        {!unanswered && !consentToGemini && <small className="stress-hint">Review the privacy note and consent before sending your answers.</small>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {assessment && assessmentByLevel[assessment.level] && <div className={`stress-meter-display ${assessmentByLevel[assessment.level].tone} stress-result`} aria-live="polite">
          <div className="stress-ai-icon"><Sparkles size={20} /></div>
          <div><strong>Gemini reflection · {assessmentByLevel[assessment.level].label}</strong><span>{assessmentByLevel[assessment.level].message}</span></div>
        </div>}
        {assessment && <div className="stress-suggestions">
          <h3>Small next steps</h3>
          <p><Sparkles size={14} /> Try a slow, comfortable exhale or name five things you can see around you.</p>
          <p><UserRound size={14} /> Consider calling or messaging someone you trust.</p>
          <p><Info size={14} /> If there is immediate danger, skip this check-in and get emergency help now.</p>
          <Link to="/contacts" className="panel-link">View trusted contacts</Link>
        </div>}
        <small className="stress-disclaimer"><Info size={13} /> AI-generated, non-clinical reflection. It is not a diagnosis, validated screening, or substitute for professional support. Do not use it to make health decisions or delay emergency help.</small>
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
