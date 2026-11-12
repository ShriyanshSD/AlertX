import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const axisProps = { tick: { fill: '#8493a5', fontSize: 11 }, axisLine: false, tickLine: false };
const tooltipStyle = { background: '#121a25', border: '1px solid #293849', borderRadius: 9, color: '#edf2f8' };

export function ActivityAreaChart({ data }) {
  return <div className="activity-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 3, left: -20, bottom: 0 }}><defs><linearGradient id="medicalFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f8cff" stopOpacity={0.22} /><stop offset="100%" stopColor="#4f8cff" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#253241" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="time" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="medical" name="Medical" stroke="#4f8cff" fill="url(#medicalFill)" strokeWidth={2} /><Area type="monotone" dataKey="fire" name="Fire" stroke="#ff794f" fill="transparent" strokeWidth={2} /><Area type="monotone" dataKey="safety" name="Safety" stroke="#34d399" fill="transparent" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>;
}

export function ActivityBarChart({ data }) {
  return <div className="admin-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}><CartesianGrid stroke="#253241" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="time" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="medical" name="Medical" fill="#4f8cff" radius={[4, 4, 0, 0]} /><Bar dataKey="fire" name="Fire" fill="#ff794f" radius={[4, 4, 0, 0]} /><Bar dataKey="safety" name="Safety" fill="#34d399" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>;
}
