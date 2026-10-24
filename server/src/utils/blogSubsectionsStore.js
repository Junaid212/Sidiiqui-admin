/**
 * blogSubsectionsStore.js — Persistent store for Blog repeatable sub-sections and pull quote position
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'blog_subsections.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAll() {
  ensureDir();
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf8');
      return JSON.parse(raw) || {};
    }
  } catch (err) {
    console.warn('[blogSubsectionsStore] Failed to read store:', err.message);
  }
  return {};
}

function writeAll(data) {
  ensureDir();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[blogSubsectionsStore] Failed to write store:', err.message);
  }
}

function getSubsections(blogId) {
  if (!blogId) return { sub_sections: [], pull_quote_position: 1 };
  const all = readAll();
  const entry = all[String(blogId)] || {};
  return {
    sub_sections: Array.isArray(entry.sub_sections) ? entry.sub_sections : [],
    pull_quote_position: entry.pull_quote_position !== undefined && entry.pull_quote_position !== null
      ? Number(entry.pull_quote_position)
      : 1,
  };
}

function setSubsections(blogId, { sub_sections, pull_quote_position }) {
  if (!blogId) return;
  const all = readAll();
  const idStr = String(blogId);

  const cleanSections = Array.isArray(sub_sections)
    ? sub_sections.map((s, idx) => ({
        id: s.id || `sub-${Date.now()}-${idx}`,
        heading: s.heading ? String(s.heading).trim() : '',
        body: s.body ? String(s.body) : '',
        highlight_type: ['none', 'quote', 'question'].includes(s.highlight_type) ? s.highlight_type : 'none',
        highlight_text: s.highlight_text ? String(s.highlight_text).trim() : '',
      }))
    : [];

  const cleanPos = pull_quote_position !== undefined && pull_quote_position !== null
    ? Number(pull_quote_position)
    : 1;

  all[idStr] = {
    sub_sections: cleanSections,
    pull_quote_position: cleanPos,
  };

  writeAll(all);
}

/**
 * Normalizes blog sub-sections, automatically migrating legacy title2/content2 to Sub-section 1
 */
function enrichBlogSubsections(blog) {
  if (!blog) return blog;
  let sub_sections = blog.sub_sections;
  let pull_quote_position = blog.pull_quote_position;

  if (typeof sub_sections === 'string') {
    try {
      sub_sections = JSON.parse(sub_sections);
    } catch (_) {
      sub_sections = null;
    }
  }

  // If not stored on DB row, check local store
  if (!Array.isArray(sub_sections) || sub_sections.length === 0) {
    const stored = getSubsections(blog.id);
    if (stored && stored.sub_sections && stored.sub_sections.length > 0) {
      sub_sections = stored.sub_sections;
      if (pull_quote_position === undefined || pull_quote_position === null) {
        pull_quote_position = stored.pull_quote_position;
      }
    }
  }

  // Automatic legacy migration: Move title2/content2 into Sub-section 1
  if ((!sub_sections || !Array.isArray(sub_sections) || sub_sections.length === 0) && (blog.title2 || blog.content2)) {
    sub_sections = [
      {
        id: 'sub-legacy-1',
        heading: blog.title2 ? String(blog.title2).trim() : '',
        body: blog.content2 ? String(blog.content2) : '',
        highlight_type: 'none',
        highlight_text: '',
      },
    ];
  }

  if (!Array.isArray(sub_sections)) {
    sub_sections = [];
  }

  return {
    ...blog,
    sub_sections,
    pull_quote_position: pull_quote_position !== undefined && pull_quote_position !== null
      ? Number(pull_quote_position)
      : 1,
  };
}

module.exports = {
  getSubsections,
  setSubsections,
  enrichBlogSubsections,
};
