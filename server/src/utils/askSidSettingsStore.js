/**
 * askSidSettingsStore.js — Settings management for Ask SID Phase 1
 * Supports Supabase table 'ask_sid_settings' with graceful local JSON fallback.
 */
const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');

const DATA_DIR = path.join(__dirname, '../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'ask_sid_settings.json');

const DEFAULT_SETTINGS = {
  askSidEnabled: true,
  publicDemoEnabled: true,
  demoQuestionLimit: 1,
  fullAccessProductId: "04b84648-3609-4b31-9ded-2486bacf1e74", // Marketing Reclassified Digital Companion Edition
  onlineEditionProductId: "prod_online_reading_001",           // Marketing Reclassified Online Edition
  upgradeCtaText: "Unlock Full Ask SID with the Digital Companion Edition ($49.99)",
  upgradeUrl: "/publications/marketing-reclassified-principle-first-approach",
  advisoryCtaEnabled: true,
  advisoryUrl: "/consultation",
  updatedAt: new Date().toISOString()
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn('[askSidSettingsStore] Failed to create data dir:', e.message);
    }
  }
}

function readLocalSettings() {
  try {
    ensureDataDir();
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('[askSidSettingsStore] Error reading local settings file:', e.message);
  }
  return { ...DEFAULT_SETTINGS };
}

function writeLocalSettings(settings) {
  try {
    ensureDataDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.warn('[askSidSettingsStore] Error writing local settings file:', e.message);
  }
}

async function getAskSidSettings() {
  // 1. Try reading from Supabase table if it exists
  try {
    const { data, error } = await supabaseAdmin
      .from('ask_sid_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (!error && data && data.settings) {
      const merged = { ...DEFAULT_SETTINGS, ...data.settings };
      writeLocalSettings(merged);
      return merged;
    }
  } catch (e) {
    // Supabase table may not exist yet, fallback gracefully
  }

  // 2. Fallback to local persistent JSON
  return readLocalSettings();
}

async function updateAskSidSettings(newSettings) {
  const current = await getAskSidSettings();
  const updated = {
    ...current,
    ...newSettings,
    updatedAt: new Date().toISOString()
  };

  // 1. Save locally
  writeLocalSettings(updated);

  // 2. Attempt upsert into Supabase table
  try {
    await supabaseAdmin
      .from('ask_sid_settings')
      .upsert({
        id: 'default',
        settings: updated,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
  } catch (e) {
    console.warn('[askSidSettingsStore] Supabase save note:', e.message);
  }

  return updated;
}

module.exports = {
  DEFAULT_SETTINGS,
  getAskSidSettings,
  updateAskSidSettings
};
