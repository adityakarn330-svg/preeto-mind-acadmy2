// Public endpoint: returns only the reviews you have published in the admin dashboard.
const { configured, sb } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  if (!configured()) return res.status(200).json({ reviews: [] });
  try {
    const rows = await sb('submissions?type=eq.review&published=eq.true&order=created_at.desc&limit=60&select=data');
    const reviews = (rows || []).map((r) => ({
      name: r.data.name || '',
      course: r.data.class_course || '',
      role: r.data.role || '',
      text: r.data.review || '',
      published: true,
    })).filter((r) => r.name && r.text);
    return res.status(200).json({ reviews });
  } catch (e) {
    console.error(e.message);
    return res.status(200).json({ reviews: [] });
  }
};
