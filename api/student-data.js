const { configured, sb } = require('./_lib');
const { currentStudent, requireSession } = require('./student-lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured()) return res.status(503).json({ error: 'Database is not configured.' });
  if (!requireSession(req, res)) return;
  try {
    const student = await currentStudent(req);
    if (!student) return res.status(401).json({ error: 'Please sign in again.' });
    const batch = student.batch_id ? (await sb('batches?id=eq.' + encodeURIComponent(student.batch_id) + '&select=id,name,description,subjects,start_date,end_date,status'))[0] : null;
    const reports = await sb('weekly_reports?student_id=eq.' + encodeURIComponent(student.id) + '&order=week_start.desc&select=id,week_start,week_end,attendance,score,topics,assignments,remarks,strengths,improvement_areas');
    return res.status(200).json({ student, batch: batch || null, reports: reports || [] });
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ error: 'Could not load your reports.' });
  }
};
