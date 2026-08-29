import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public", "icons", "lunor-app-icon.svg");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function renderPng(size, target) {
  await mkdir(path.dirname(target), { recursive: true });
  await sharp(source)
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(target);
}

async function generateWebIcons() {
  const icons = path.join(root, "public", "icons");
  await Promise.all([
    renderPng(192, path.join(icons, "lunor-icon-192-v2.png")),
    renderPng(512, path.join(icons, "lunor-icon-512-v2.png")),
    renderPng(180, path.join(icons, "apple-touch-icon-v2.png")),
  ]);
}

async function generateAndroidIcons() {
  const res = path.join(root, "android", "app", "src", "main", "res");
  if (!(await exists(res))) return;

  const sizes = {
    mdpi: { launcher: 48, foreground: 108 },
    hdpi: { launcher: 72, foreground: 162 },
    xhdpi: { launcher: 96, foreground: 216 },
    xxhdpi: { launcher: 144, foreground: 324 },
    xxxhdpi: { launcher: 192, foreground: 432 },
  };

  for (const [density, size] of Object.entries(sizes)) {
    const dir = path.join(res, `mipmap-${density}`);
    await Promise.all([
      renderPng(size.launcher, path.join(dir, "ic_launcher.png")),
      renderPng(size.launcher, path.join(dir, "ic_launcher_round.png")),
      renderPng(size.foreground, path.join(dir, "ic_launcher_foreground.png")),
    ]);
  }

  const values = path.join(res, "values", "ic_launcher_background.xml");
  await writeFile(
    values,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#080809</color>\n</resources>\n`,
    "utf8"
  );
}

async function generateIosIcons() {
  const appIconDir = path.join(
    root,
    "ios",
    "App",
    "App",
    "Assets.xcassets",
    "AppIcon.appiconset"
  );
  if (!(await exists(appIconDir))) return;

  const specs = [
    ["iphone", "20x20", "2x", 40, "AppIcon-20@2x.png"],
    ["iphone", "20x20", "3x", 60, "AppIcon-20@3x.png"],
    ["iphone", "29x29", "2x", 58, "AppIcon-29@2x.png"],
    ["iphone", "29x29", "3x", 87, "AppIcon-29@3x.png"],
    ["iphone", "40x40", "2x", 80, "AppIcon-40@2x.png"],
    ["iphone", "40x40", "3x", 120, "AppIcon-40@3x.png"],
    ["iphone", "60x60", "2x", 120, "AppIcon-60@2x.png"],
    ["iphone", "60x60", "3x", 180, "AppIcon-60@3x.png"],
    ["ipad", "20x20", "1x", 20, "AppIcon-20.png"],
    ["ipad", "20x20", "2x", 40, "AppIcon-20-ipad@2x.png"],
    ["ipad", "29x29", "1x", 29, "AppIcon-29.png"],
    ["ipad", "29x29", "2x", 58, "AppIcon-29-ipad@2x.png"],
    ["ipad", "40x40", "1x", 40, "AppIcon-40.png"],
    ["ipad", "40x40", "2x", 80, "AppIcon-40-ipad@2x.png"],
    ["ipad", "76x76", "1x", 76, "AppIcon-76.png"],
    ["ipad", "76x76", "2x", 152, "AppIcon-76@2x.png"],
    ["ipad", "83.5x83.5", "2x", 167, "AppIcon-83.5@2x.png"],
    ["ios-marketing", "1024x1024", "1x", 1024, "AppIcon-1024.png"],
  ];

  await Promise.all(
    specs.map(([, , , pixels, filename]) =>
      renderPng(pixels, path.join(appIconDir, filename))
    )
  );

  const contents = {
    images: specs.map(([idiom, size, scale, , filename]) => ({
      idiom,
      size,
      scale,
      filename,
    })),
    info: { author: "xcode", version: 1 },
  };
  await writeFile(
    path.join(appIconDir, "Contents.json"),
    `${JSON.stringify(contents, null, 2)}\n`,
    "utf8"
  );
}

await generateWebIcons();
await generateAndroidIcons();
await generateIosIcons();

console.log("LUNOR mobile icons generated from public/icons/lunor-app-icon.svg");
