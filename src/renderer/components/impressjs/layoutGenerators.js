/* eslint-disable prettier/prettier */
/**
 * Layout generators for impress.js presentations
 * Each generator creates animation parameters based on slide count
 */

/**
 * Available layout themes
 */
export const LayoutThemes = {
  SPIRAL: 'spiral',
  LINEAR: 'linear',
  GRID: 'grid',
  CIRCULAR: 'circular',
  DEPTH_ZOOM: 'depth_zoom',
  RANDOM_WALK: 'random_walk',
  STORYTELLING: 'storytelling',
  HELIX: 'helix',
  MOBIUS: 'mobius',
  EXPLODED_TEXT: 'exploded_text',
  Z_TUNNEL: 'z_tunnel',
  PAGE_TURN_BOOK: 'page_turn_book',
};

/**
 * Generate spiral layout - slides spiral outward from center
 * @param {number} count - Number of slides
 * @returns {string[]} Array of data attribute strings
 */
function generateSpiralLayout(count) {
  const layouts = [];
  const baseRadius = 800;
  const radiusIncrement = 400;
  const angleIncrement = 360 / Math.min(count, 8);

  for (let i = 0; i < count; i++) {
    const angle = (i * angleIncrement * Math.PI) / 180;
    const radius = baseRadius + i * radiusIncrement;
    const x = Math.round(radius * Math.cos(angle));
    const y = Math.round(radius * Math.sin(angle));
    const rotate = Math.round(i * angleIncrement) % 360;
    const scale = 1 + (i % 3);
    const z = i % 4 === 0 ? -500 : 0;

    layouts.push(
      ` class="step" data-x="${x}" data-y="${y}" data-z="${z}" data-rotate="${rotate}" data-scale="${scale}"`
    );
  }
  return layouts;
}

/**
 * Generate linear layout - slides flow horizontally with variations
 * @param {number} count - Number of slides
 * @returns {string[]} Array of data attribute strings
 */
function generateLinearLayout(count) {
  const layouts = [];
  const xSpacing = 1200;

  for (let i = 0; i < count; i++) {
    const x = i * xSpacing;
    const y = (i % 2 === 0 ? 0 : 200) + Math.sin(i * 0.5) * 100;
    const rotate = i % 3 === 0 ? 0 : (i % 2 === 0 ? 5 : -5);
    const scale = i === 0 || i === count - 1 ? 2 : 1;

    layouts.push(
      ` class="step slide" data-x="${Math.round(x)}" data-y="${Math.round(y)}" data-rotate="${rotate}" data-scale="${scale}"`
    );
  }
  return layouts;
}

/**
 * Generate grid layout - slides arranged in a grid pattern
 * @param {number} count - Number of slides
 * @returns {string[]} Array of data attribute strings
 */
function generateGridLayout(count) {
  const layouts = [];
  const cols = Math.ceil(Math.sqrt(count));
  const xSpacing = 1400;
  const ySpacing = 1000;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * xSpacing;
    const y = row * ySpacing;
    const rotate = (col + row) % 2 === 0 ? 0 : 180;
    const scale = row === 0 ? 1.5 : 1;

    layouts.push(
      ` class="step" data-x="${x}" data-y="${y}" data-rotate="${rotate}" data-scale="${scale}"`
    );
  }
  return layouts;
}

/**
 * Generate circular layout - slides arranged in a circle
 * @param {number} count - Number of slides
 * @returns {string[]} Array of data attribute strings
 */
function generateCircularLayout(count) {
  const layouts = [];
  const radius = Math.max(1500, count * 150);
  const angleStep = 360 / count;

  for (let i = 0; i < count; i++) {
    const angle = (i * angleStep * Math.PI) / 180;
    const x = Math.round(radius * Math.cos(angle));
    const y = Math.round(radius * Math.sin(angle));
    const rotate = Math.round(i * angleStep + 90);
    const scale = i === 0 ? 2 : 1;

    layouts.push(
      ` class="step" data-x="${x}" data-y="${y}" data-rotate="${rotate}" data-scale="${scale}"`
    );
  }
  return layouts;
}

/**
 * Generate depth zoom layout - slides move through Z-axis with zoom effects
 * @param {number} count - Number of slides
 * @returns {string[]} Array of data attribute strings
 */
function generateDepthZoomLayout(count) {
  const layouts = [];
  const zSpacing = -800;

  for (let i = 0; i < count; i++) {
    const x = (i % 2 === 0 ? -1 : 1) * (i * 100);
    const y = Math.sin(i * 0.8) * 300;
    const z = i * zSpacing;
    const scale = 1 + (i % 4) * 0.5;
    const rotateX = i % 3 === 0 ? -20 : 0;
    const rotateY = i % 2 === 0 ? 15 : -15;

    layouts.push(
      ` class="step" data-x="${Math.round(x)}" data-y="${Math.round(y)}" data-z="${z}" data-rotate-x="${rotateX}" data-rotate-y="${rotateY}" data-scale="${scale}"`
    );
  }
  return layouts;
}

/**
 * Generate random walk layout - slides positioned with controlled randomness
 * @param {number} count - Number of slides
 * @returns {string[]} Array of data attribute strings
 */
function generateRandomWalkLayout(count) {
  const layouts = [];
  let x = 0;
  let y = 0;
  const seed = Date.now() % 1000;

  // Seeded random for reproducibility within same presentation
  const seededRandom = (i) => {
    const val = Math.sin(seed + i * 12.9898) * 43758.5453;
    return val - Math.floor(val);
  };

  for (let i = 0; i < count; i++) {
    const angle = seededRandom(i) * Math.PI * 2;
    const distance = 800 + seededRandom(i + 100) * 600;
    x += Math.cos(angle) * distance;
    y += Math.sin(angle) * distance;
    const rotate = Math.round(seededRandom(i + 200) * 360);
    const scale = 1 + Math.round(seededRandom(i + 300) * 3);
    const z = seededRandom(i + 400) > 0.7 ? -1000 : 0;

    layouts.push(
      ` class="step" data-x="${Math.round(x)}" data-y="${Math.round(y)}" data-z="${z}" data-rotate="${rotate}" data-scale="${scale}"`
    );
  }
  return layouts;
}

/**
 * Generate storytelling layout - cinematic progression with dramatic transitions
 * @param {number} count - Number of slides
 * @returns {string[]} Array of data attribute strings
 */
function generateStorytellingLayout(count) {
  const layouts = [];

  for (let i = 0; i < count; i++) {
    let attrs;
    const phase = i / count; // 0 to 1 progression

    if (i === 0) {
      // Opening - centered, large
      attrs = ` class="step" data-x="0" data-y="0" data-scale="4"`;
    } else if (i === count - 1) {
      // Finale - dramatic zoom out
      attrs = ` class="step" data-x="3000" data-y="1500" data-z="0" data-scale="10"`;
    } else if (phase < 0.3) {
      // Act 1 - horizontal progression
      const x = i * 1500;
      const y = -1500;
      attrs = ` class="step slide" data-x="${x}" data-y="${y}"`;
    } else if (phase < 0.6) {
      // Act 2 - diagonal with rotation
      const x = 2000 + (i - Math.floor(count * 0.3)) * 1200;
      const y = -1500 + (i - Math.floor(count * 0.3)) * 1000;
      const rotate = 45;
      attrs = ` class="step" data-x="${x}" data-y="${y}" data-rotate="${rotate}" data-scale="2"`;
    } else {
      // Act 3 - 3D depth exploration
      const idx = i - Math.floor(count * 0.6);
      const x = 4000 + idx * 800;
      const y = 2000 + Math.sin(idx) * 500;
      const z = -idx * 500;
      const rotateX = -20;
      attrs = ` class="step" data-x="${Math.round(x)}" data-y="${Math.round(y)}" data-z="${z}" data-rotate-x="${rotateX}" data-scale="1.5"`;
    }
    layouts.push(attrs);
  }
  return layouts;
}

/**
 * Generate helix layout - slides spiral up a vertical axis (DNA-like).
 * @param {number} count
 * @returns {string[]}
 */
function generateHelixLayout(count) {
  const layouts = [];
  const radius = 1200;
  const angleStep = 60;
  const yStep = 500;
  for (let i = 0; i < count; i++) {
    const angleDeg = i * angleStep;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = Math.round(radius * Math.cos(angleRad));
    const z = Math.round(radius * Math.sin(angleRad));
    const y = -i * yStep;
    const rotateY = -angleDeg;
    layouts.push(
      ` class="step" data-x="${x}" data-y="${y}" data-z="${z}" data-rotate-y="${rotateY}" data-scale="1"`,
    );
  }
  return layouts;
}

/**
 * Generate mobius layout - half-twisted circular ring.
 * @param {number} count
 * @returns {string[]}
 */
function generateMobiusLayout(count) {
  const layouts = [];
  const radius = 1500;
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(count - 1, 1);
    const angle = t * Math.PI * 2;
    const x = Math.round(radius * Math.cos(angle));
    const z = Math.round(radius * Math.sin(angle));
    const y = Math.round(Math.sin(angle * 2) * 200);
    const rotateY = -Math.round((angle * 180) / Math.PI);
    const rotateZ = Math.round(t * 180); // half-twist
    layouts.push(
      ` class="step" data-x="${x}" data-y="${y}" data-z="${z}" data-rotate-y="${rotateY}" data-rotate-z="${rotateZ}"`,
    );
  }
  return layouts;
}

/**
 * Generate exploded text layout - slides shot outward from center in 3 concentric rings.
 * @param {number} count
 * @returns {string[]}
 */
function generateExplodedTextLayout(count) {
  const layouts = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 800 + (i % 3) * 300;
    const x = Math.round(r * Math.cos(angle));
    const y = Math.round(r * Math.sin(angle));
    const z = (i % 2 === 0 ? -1 : 1) * 600;
    const rotate = Math.round((angle * 180) / Math.PI);
    layouts.push(
      ` class="step" data-x="${x}" data-y="${y}" data-z="${z}" data-rotate="${rotate}"`,
    );
  }
  return layouts;
}

/**
 * Generate Z-tunnel layout - slides recede into the distance with scaling.
 * @param {number} count
 * @returns {string[]}
 */
function generateZTunnelLayout(count) {
  return Array.from(
    { length: count },
    (_, i) =>
      ` class="step" data-x="0" data-y="0" data-z="${-i * 1500}" data-scale="${1 + i * 0.5}"`,
  );
}

/**
 * Generate page-turn book layout - slides arranged as facing book pages with Y-rotation.
 * @param {number} count
 * @returns {string[]}
 */
function generatePageTurnBookLayout(count) {
  const layouts = [];
  for (let i = 0; i < count; i++) {
    const spread = Math.floor(i / 2);
    const side = i % 2 === 0 ? -800 : 800;
    layouts.push(
      ` class="step" data-x="${spread * 100 + side}" data-y="0" data-z="0" data-rotate-y="${i * 30}"`,
    );
  }
  return layouts;
}

/**
 * Generate layout based on theme
 * @param {string} theme - Layout theme name
 * @param {number} count - Number of slides
 * @returns {string[]} Array of data attribute strings
 */
export function generateLayout(theme, count) {
  switch (theme) {
    case LayoutThemes.SPIRAL:
      return generateSpiralLayout(count);
    case LayoutThemes.LINEAR:
      return generateLinearLayout(count);
    case LayoutThemes.GRID:
      return generateGridLayout(count);
    case LayoutThemes.CIRCULAR:
      return generateCircularLayout(count);
    case LayoutThemes.DEPTH_ZOOM:
      return generateDepthZoomLayout(count);
    case LayoutThemes.RANDOM_WALK:
      return generateRandomWalkLayout(count);
    case LayoutThemes.STORYTELLING:
      return generateStorytellingLayout(count);
    case LayoutThemes.HELIX:
      return generateHelixLayout(count);
    case LayoutThemes.MOBIUS:
      return generateMobiusLayout(count);
    case LayoutThemes.EXPLODED_TEXT:
      return generateExplodedTextLayout(count);
    case LayoutThemes.Z_TUNNEL:
      return generateZTunnelLayout(count);
    case LayoutThemes.PAGE_TURN_BOOK:
      return generatePageTurnBookLayout(count);
    default:
      return generateSpiralLayout(count);
  }
}

/**
 * Suggest a layout theme based on content characteristics
 * @param {string} suggestedTheme - AI suggested theme (if any)
 * @param {number} slideCount - Number of slides
 * @param {string[]} contents - Slide contents
 * @returns {string} Recommended layout theme
 */
export function selectLayoutTheme(suggestedTheme, slideCount, contents) {
  // If AI suggested a valid theme, use it
  if (suggestedTheme && Object.values(LayoutThemes).includes(suggestedTheme)) {
    return suggestedTheme;
  }

  // Analyze content to suggest theme
  const contentStr = contents.join(' ').toLowerCase();
  const hasLists = contentStr.includes('<ul>') || contentStr.includes('<ol>');
  const hasTables = contentStr.includes('<table>');
  const hasSteps = /step\s*\d|first|second|third|then|next|finally/i.test(contentStr);

  // Heuristic-based selection
  if (slideCount <= 3) {
    return LayoutThemes.LINEAR;
  }
  if (hasTables || hasLists) {
    return LayoutThemes.GRID;
  }
  if (hasSteps) {
    return LayoutThemes.STORYTELLING;
  }
  if (slideCount > 8) {
    return LayoutThemes.SPIRAL;
  }

  // Random selection for variety
  const themes = [
    LayoutThemes.CIRCULAR,
    LayoutThemes.DEPTH_ZOOM,
    LayoutThemes.RANDOM_WALK,
    LayoutThemes.STORYTELLING,
  ];
  return themes[Math.floor(Math.random() * themes.length)];
}
