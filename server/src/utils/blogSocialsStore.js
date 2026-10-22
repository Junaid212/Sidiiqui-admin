/**
 * blogSocialsStore.js — Persistent store for Blog social links (LinkedIn, Instagram, Facebook)
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'blog_socials.json');

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
    console.warn('[blogSocialsStore] Failed to read store:', err.message);
  }
  return {};
}

function writeAll(data) {
  ensureDir();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[blogSocialsStore] Failed to write store:', err.message);
  }
}

function getSocials(blogId) {
  if (!blogId) return { linkedin_url: null, instagram_url: null, facebook_url: null };
  const all = readAll();
  const entry = all[String(blogId)] || {};
  return {
    linkedin_url: entry.linkedin_url ? String(entry.linkedin_url).trim() : null,
    instagram_url: entry.instagram_url ? String(entry.instagram_url).trim() : null,
    facebook_url: entry.facebook_url ? String(entry.facebook_url).trim() : null,
  };
}

function setSocials(blogId, { linkedin_url, instagram_url, facebook_url }) {
  if (!blogId) return;
  const all = readAll();
  const idStr = String(blogId);

  const cleanLinkedin = linkedin_url && String(linkedin_url).trim() ? String(linkedin_url).trim() : null;
  const cleanInstagram = instagram_url && String(instagram_url).trim() ? String(instagram_url).trim() : null;
  const cleanFacebook = facebook_url && String(facebook_url).trim() ? String(facebook_url).trim() : null;

  if (!cleanLinkedin && !cleanInstagram && !cleanFacebook) {
    delete all[idStr];
  } else {
    all[idStr] = {
      linkedin_url: cleanLinkedin,
      instagram_url: cleanInstagram,
      facebook_url: cleanFacebook,
      updated_at: new Date().toISOString()
    };
  }
  writeAll(all);
}

function deleteSocials(blogId) {
  if (!blogId) return;
  const all = readAll();
  delete all[String(blogId)];
  writeAll(all);
}

module.exports = {
  getSocials,
  setSocials,
  deleteSocials,
  readAll,
};
