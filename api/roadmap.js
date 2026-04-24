const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DATABASE_ID;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const response = await notion.databases.query({ database_id: DB_ID });
      const rows = response.results.map(page => ({
        id: page.id,
        name: page.properties.Name?.title?.[0]?.plain_text || '',
        status: page.properties.Status?.select?.name || 'To Build',
        priority: page.properties.Priority?.select?.name || 'Low',
        description: page.properties.Description?.rich_text?.[0]?.plain_text || '',
      }));
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, status } = req.body;
      if (!id || !status) return res.status(400).json({ error: 'id and status required' });
      await notion.pages.update({
        page_id: id,
        properties: { Status: { select: { name: status } } },
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
