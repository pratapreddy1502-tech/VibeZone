const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');
const SIZE = 1024;
const SCALE = 2;
const WORK_SIZE = SIZE * SCALE;

const COLORS = {
  white: [255, 255, 255],
  softLavender: [246, 242, 255],
  purple: [124, 58, 237],
  violet: [168, 85, 247],
  pink: [236, 72, 153],
  ink: [52, 24, 104],
};

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function gradientAt(x, y) {
  const t = clamp((x + y * 0.72) / (WORK_SIZE * 1.72), 0, 1);
  const left = t < 0.58;
  const local = left ? t / 0.58 : (t - 0.58) / 0.42;
  const from = left ? COLORS.purple : COLORS.violet;
  const to = left ? COLORS.violet : COLORS.pink;

  return [
    Math.round(mix(from[0], to[0], local)),
    Math.round(mix(from[1], to[1], local)),
    Math.round(mix(from[2], to[2], local)),
  ];
}

function createImage(width, height, fill = COLORS.white) {
  const image = new PNG({ width, height });

  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = fill[0];
    image.data[i + 1] = fill[1];
    image.data[i + 2] = fill[2];
    image.data[i + 3] = 255;
  }

  return image;
}

function blendPixel(image, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height || alpha <= 0) {
    return;
  }

  const index = (y * image.width + x) * 4;
  const existingAlpha = image.data[index + 3] / 255;
  const sourceAlpha = clamp(alpha, 0, 1);
  const outAlpha = sourceAlpha + existingAlpha * (1 - sourceAlpha);

  if (outAlpha <= 0) {
    return;
  }

  for (let channel = 0; channel < 3; channel += 1) {
    const existing = image.data[index + channel];
    image.data[index + channel] = Math.round(
      (color[channel] * sourceAlpha + existing * existingAlpha * (1 - sourceAlpha)) /
        outAlpha
    );
  }

  image.data[index + 3] = Math.round(outAlpha * 255);
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLengthSquared = abx * abx + aby * aby;
  const t = abLengthSquared === 0 ? 0 : clamp((apx * abx + apy * aby) / abLengthSquared, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;

  return Math.sqrt(dx * dx + dy * dy);
}

function drawLine(image, start, end, width, options = {}) {
  const radius = width / 2;
  const softness = options.softness ?? 1.6 * SCALE;
  const extra = radius + softness + 2 * SCALE;
  const minX = Math.floor(Math.min(start.x, end.x) - extra);
  const maxX = Math.ceil(Math.max(start.x, end.x) + extra);
  const minY = Math.floor(Math.min(start.y, end.y) - extra);
  const maxY = Math.ceil(Math.max(start.y, end.y) + extra);
  const alpha = options.alpha ?? 1;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = distanceToSegment(x + 0.5, y + 0.5, start.x, start.y, end.x, end.y);

      if (d > radius + softness) {
        continue;
      }

      const edgeAlpha = d <= radius ? 1 : 1 - (d - radius) / softness;
      const color =
        typeof options.color === 'function'
          ? options.color(x, y)
          : options.color || gradientAt(x, y);

      blendPixel(image, x, y, color, edgeAlpha * alpha);
    }
  }
}

function drawRoundedRect(image, x, y, width, height, radius, color, alpha) {
  const right = x + width;
  const bottom = y + height;
  const softness = 1.5 * SCALE;

  for (let py = Math.floor(y - softness); py <= Math.ceil(bottom + softness); py += 1) {
    for (let px = Math.floor(x - softness); px <= Math.ceil(right + softness); px += 1) {
      const qx = Math.max(x + radius - px, 0, px - (right - radius));
      const qy = Math.max(y + radius - py, 0, py - (bottom - radius));
      const distance = Math.sqrt(qx * qx + qy * qy) - radius;

      if (distance > softness) {
        continue;
      }

      const edgeAlpha = distance <= 0 ? 1 : 1 - distance / softness;
      blendPixel(image, px, py, color, edgeAlpha * alpha);
    }
  }
}

function drawRadialGlow(image, centerX, centerY, radius, color, maxAlpha) {
  const minX = Math.floor(centerX - radius);
  const maxX = Math.ceil(centerX + radius);
  const minY = Math.floor(centerY - radius);
  const maxY = Math.ceil(centerY + radius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > radius) {
        continue;
      }

      const t = distance / radius;
      const alpha = (1 - t) * (1 - t) * maxAlpha;
      blendPixel(image, x, y, color, alpha);
    }
  }
}

function drawMonogram(image, offsetX = 0, offsetY = 0, colorOverride = null, alpha = 1, widthAdjust = 0) {
  const point = (x, y) => ({
    x: x * SCALE + offsetX,
    y: y * SCALE + offsetY,
  });
  const color = colorOverride ? () => colorOverride : gradientAt;
  const stroke = 92 * SCALE + widthAdjust;
  const options = { color, alpha, softness: 1.4 * SCALE };

  drawLine(image, point(272, 305), point(398, 722), stroke, options);
  drawLine(image, point(398, 722), point(525, 305), stroke, options);
  drawLine(image, point(560, 315), point(785, 315), stroke, options);
  drawLine(image, point(785, 315), point(555, 712), stroke, options);
  drawLine(image, point(555, 712), point(800, 712), stroke, options);
}

function downsample(source, targetSize) {
  const target = createImage(targetSize, targetSize);
  const ratio = source.width / targetSize;
  const samples = Math.max(1, Math.floor(ratio));

  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const srcX = Math.min(source.width - 1, Math.floor(x * ratio + sx));
          const srcY = Math.min(source.height - 1, Math.floor(y * ratio + sy));
          const srcIndex = (srcY * source.width + srcX) * 4;

          r += source.data[srcIndex];
          g += source.data[srcIndex + 1];
          b += source.data[srcIndex + 2];
          a += source.data[srcIndex + 3];
          count += 1;
        }
      }

      const targetIndex = (y * targetSize + x) * 4;
      target.data[targetIndex] = Math.round(r / count);
      target.data[targetIndex + 1] = Math.round(g / count);
      target.data[targetIndex + 2] = Math.round(b / count);
      target.data[targetIndex + 3] = Math.round(a / count);
    }
  }

  return target;
}

function writePng(filename, image) {
  const outputPath = path.join(ASSETS_DIR, filename);
  fs.writeFileSync(outputPath, PNG.sync.write(image, { colorType: 6 }));
  console.log(`Wrote ${outputPath}`);
}

function buildIcon() {
  const image = createImage(WORK_SIZE, WORK_SIZE);

  drawRadialGlow(image, 512 * SCALE, 510 * SCALE, 410 * SCALE, COLORS.softLavender, 0.8);
  drawRoundedRect(
    image,
    118 * SCALE,
    118 * SCALE,
    788 * SCALE,
    788 * SCALE,
    210 * SCALE,
    [255, 255, 255],
    0.62
  );
  drawRoundedRect(
    image,
    132 * SCALE,
    132 * SCALE,
    760 * SCALE,
    760 * SCALE,
    196 * SCALE,
    [241, 235, 255],
    0.22
  );

  for (let i = 9; i >= 1; i -= 1) {
    drawMonogram(
      image,
      0,
      (18 + i * 2) * SCALE,
      COLORS.ink,
      0.013 * i,
      i * 5 * SCALE
    );
  }

  drawMonogram(image, 0, 0, null, 1, 0);
  drawMonogram(image, -5 * SCALE, -7 * SCALE, [255, 255, 255], 0.12, -58 * SCALE);

  return downsample(image, SIZE);
}

const icon = buildIcon();
writePng('icon.png', icon);
writePng('adaptive-icon.png', icon);
writePng('favicon.png', downsample(icon, 48));
