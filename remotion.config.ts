import { Config } from "@remotion/cli/config";

/**
 * Config Remotion pour Louis.
 *
 * Compositions : voir `remotion/Root.tsx`.
 *
 * Render commands (déclarés dans package.json) :
 *   - npm run video:preview  → preview navigateur en dev
 *   - npm run video:render   → public/hero-demo.mp4 (h264, CRF 23)
 *   - npm run video:poster   → public/hero-poster.jpg (frame 120 ≈ 4s)
 */

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
