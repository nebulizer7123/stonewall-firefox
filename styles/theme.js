'use strict';

(function initStonewallTheme(globalScope) {
  const STORAGE_KEY = 'themeSettings';
  const MODE_LIGHT = 'light';
  const MODE_DARK = 'dark';
  const STYLE_CLASSIC = 'classic';
  const STYLE_NEON = 'neon';
  const EDITABLE_KEYS = ['background', 'surface', 'text', 'accent', 'button', 'buttonText'];

  const LIGHT_BASE = Object.freeze({
    background: '#ffffff',
    surface: '#ffffff',
    text: '#1f1d24',
    accent: '#16b7e8',
    button: '#b64b36',
    buttonText: '#ffffff'
  });

  const DARK_BASE = Object.freeze({
    background: '#161326',
    surface: '#211d35',
    text: '#f5ecff',
    accent: '#36f2ff',
    button: '#d4553e',
    buttonText: '#fff7f2'
  });

  const DEFAULT_THEME_SETTINGS = Object.freeze({
    mode: MODE_LIGHT,
    style: STYLE_CLASSIC,
    palettes: {
      light: Object.assign({}, LIGHT_BASE),
      dark: Object.assign({}, DARK_BASE)
    }
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeMode(mode) {
    return mode === MODE_DARK ? MODE_DARK : MODE_LIGHT;
  }

  function normalizeStyle(style) {
    return style === STYLE_NEON ? STYLE_NEON : STYLE_CLASSIC;
  }

  function normalizeHex(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
      const r = trimmed[1];
      const g = trimmed[2];
      const b = trimmed[3];
      return (`#${r}${r}${g}${g}${b}${b}`).toLowerCase();
    }
    return fallback;
  }

  function sanitizePalette(rawPalette, defaults) {
    const source = rawPalette && typeof rawPalette === 'object' ? rawPalette : {};
    const palette = {};
    EDITABLE_KEYS.forEach((key) => {
      palette[key] = normalizeHex(source[key], defaults[key]);
    });
    return palette;
  }

  function normalizeThemeSettings(rawSettings) {
    const mode = normalizeMode(rawSettings && rawSettings.mode);
    const style = normalizeStyle(rawSettings && rawSettings.style);
    const sourcePalettes = rawSettings && rawSettings.palettes && typeof rawSettings.palettes === 'object'
      ? rawSettings.palettes
      : {};

    const normalized = {
      mode,
      style,
      palettes: {
        light: sanitizePalette(sourcePalettes.light, LIGHT_BASE),
        dark: sanitizePalette(sourcePalettes.dark, DARK_BASE)
      }
    };

    if ((!rawSettings || !rawSettings.palettes) && rawSettings && rawSettings.colors) {
      const targetMode = normalizeMode(rawSettings.mode);
      const fallback = targetMode === MODE_DARK ? DARK_BASE : LIGHT_BASE;
      normalized.palettes[targetMode] = sanitizePalette(rawSettings.colors, fallback);
    }

    return normalized;
  }

  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  function rgbToHex(rgb) {
    const r = Math.max(0, Math.min(255, Math.round(rgb.r))).toString(16).padStart(2, '0');
    const g = Math.max(0, Math.min(255, Math.round(rgb.g))).toString(16).padStart(2, '0');
    const b = Math.max(0, Math.min(255, Math.round(rgb.b))).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  function mixHex(first, second, secondWeight) {
    const weight = typeof secondWeight === 'number' ? Math.max(0, Math.min(1, secondWeight)) : 0.5;
    const one = hexToRgb(first);
    const two = hexToRgb(second);
    return rgbToHex({
      r: one.r * (1 - weight) + two.r * weight,
      g: one.g * (1 - weight) + two.g * weight,
      b: one.b * (1 - weight) + two.b * weight
    });
  }

  function withAlpha(hex, alpha) {
    const rgb = hexToRgb(hex);
    const normalizedAlpha = typeof alpha === 'number' ? Math.max(0, Math.min(1, alpha)) : 1;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${normalizedAlpha})`;
  }

  function buildComputedPalette(settings) {
    const normalized = normalizeThemeSettings(settings);
    const mode = normalized.mode;
    const style = normalized.style;
    const base = normalized.palettes[mode];
    const isDark = mode === MODE_DARK;
    const isNeon = style === STYLE_NEON;
    const white = '#ffffff';
    const black = '#000000';
    const transparent = 'rgba(0, 0, 0, 0)';

    return {
      mode,
      style,
      background: base.background,
      backgroundAlt: isNeon
        ? mixHex(base.background, base.accent, isDark ? 0.14 : 0.08)
        : (isDark ? mixHex(base.background, base.surface, 0.16) : base.background),
      surface: base.surface,
      text: base.text,
      muted: mixHex(base.text, base.background, isDark ? 0.52 : 0.58),
      accent: base.accent,
      accentSoft: mixHex(base.accent, base.surface, isDark ? 0.78 : 0.9),
      border: mixHex(base.text, base.surface, isDark ? 0.78 : 0.88),
      tableHead: mixHex(base.accent, base.surface, isDark ? 0.84 : 0.93),
      input: mixHex(base.background, base.surface, isDark ? 0.55 : 0.48),
      button: base.button,
      buttonHover: mixHex(base.button, black, isDark ? 0.24 : 0.18),
      buttonText: base.buttonText,
      buttonDisabled: mixHex(base.button, base.surface, isDark ? 0.74 : 0.72),
      buttonDisabledText: mixHex(base.text, base.surface, isDark ? 0.6 : 0.65),
      popupChipBg: mixHex(base.button, base.surface, isDark ? 0.82 : 0.88),
      popupChipText: mixHex(base.buttonText, base.button, isDark ? 0.64 : 0.46),
      shadow: withAlpha(mixHex(base.text, black, 0.3), isDark ? 0.38 : 0.12),
      accentShadow: withAlpha(base.accent, isNeon ? (isDark ? 0.5 : 0.42) : (isDark ? 0.3 : 0.2)),
      progressTrack: mixHex(base.button, base.surface, isDark ? 0.72 : 0.82),
      progressStart: mixHex(base.button, base.accent, 0.35),
      progressEnd: mixHex(base.accent, white, isDark ? 0.12 : 0.2),
      overlay: withAlpha(base.surface, isDark ? 0.9 : 0.94),
      noBreakBg: mixHex(base.surface, base.background, 0.5),
      noBreakText: mixHex(base.text, base.surface, isDark ? 0.56 : 0.64),
      bgGlowA: isNeon ? withAlpha(base.accent, isDark ? 0.24 : 0.18) : transparent,
      bgGlowB: isNeon ? withAlpha(mixHex(base.button, base.accent, 0.5), isDark ? 0.22 : 0.16) : transparent
    };
  }

  function applyTheme(settings) {
    const normalized = normalizeThemeSettings(settings);
    const palette = buildComputedPalette(normalized);
    const root = document.documentElement;

    root.classList.remove('theme-light', 'theme-dark', 'theme-style-classic', 'theme-style-neon');
    root.classList.add(palette.mode === MODE_DARK ? 'theme-dark' : 'theme-light');
    root.classList.add(palette.style === STYLE_NEON ? 'theme-style-neon' : 'theme-style-classic');

    const cssVars = {
      '--theme-bg': palette.background,
      '--theme-bg-alt': palette.backgroundAlt,
      '--theme-surface': palette.surface,
      '--theme-text': palette.text,
      '--theme-muted': palette.muted,
      '--theme-accent': palette.accent,
      '--theme-accent-soft': palette.accentSoft,
      '--theme-border': palette.border,
      '--theme-table-head': palette.tableHead,
      '--theme-input': palette.input,
      '--theme-button-bg': palette.button,
      '--theme-button-hover': palette.buttonHover,
      '--theme-button-text': palette.buttonText,
      '--theme-button-disabled': palette.buttonDisabled,
      '--theme-button-disabled-text': palette.buttonDisabledText,
      '--theme-popup-chip-bg': palette.popupChipBg,
      '--theme-popup-chip-text': palette.popupChipText,
      '--theme-shadow': palette.shadow,
      '--theme-accent-shadow': palette.accentShadow,
      '--theme-progress-track': palette.progressTrack,
      '--theme-progress-start': palette.progressStart,
      '--theme-progress-end': palette.progressEnd,
      '--theme-overlay': palette.overlay,
      '--theme-no-break-bg': palette.noBreakBg,
      '--theme-no-break-text': palette.noBreakText,
      '--theme-bg-glow-a': palette.bgGlowA,
      '--theme-bg-glow-b': palette.bgGlowB
    };

    Object.keys(cssVars).forEach((key) => {
      root.style.setProperty(key, cssVars[key]);
    });

    return normalized;
  }

  async function loadAndApplyTheme() {
    if (!globalScope.browser || !browser.storage || !browser.storage.local) {
      applyTheme(DEFAULT_THEME_SETTINGS);
      return;
    }

    try {
      const data = await browser.storage.local.get([STORAGE_KEY]);
      applyTheme(data[STORAGE_KEY]);
    } catch (error) {
      applyTheme(DEFAULT_THEME_SETTINGS);
    }
  }

  if (globalScope.browser && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[STORAGE_KEY]) return;
      applyTheme(changes[STORAGE_KEY].newValue);
    });
  }

  loadAndApplyTheme();

  globalScope.stonewallTheme = {
    STORAGE_KEY,
    MODE_LIGHT,
    MODE_DARK,
    STYLE_CLASSIC,
    STYLE_NEON,
    EDITABLE_KEYS: EDITABLE_KEYS.slice(),
    LIGHT_BASE: Object.assign({}, LIGHT_BASE),
    DARK_BASE: Object.assign({}, DARK_BASE),
    DEFAULT_THEME_SETTINGS: clone(DEFAULT_THEME_SETTINGS),
    createDefaultSettings(mode, style) {
      const settings = clone(DEFAULT_THEME_SETTINGS);
      settings.mode = normalizeMode(mode);
      settings.style = normalizeStyle(style);
      return settings;
    },
    getDefaultPalette(mode) {
      const normalizedMode = normalizeMode(mode);
      return Object.assign({}, normalizedMode === MODE_DARK ? DARK_BASE : LIGHT_BASE);
    },
    normalizeThemeSettings,
    applyTheme
  };
})(window);
