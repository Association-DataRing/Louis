import { Composition } from "remotion";
import { LouisDemo } from "./compositions/LouisDemo";
import { LouisOg } from "./compositions/LouisOg";

/**
 * Registre des compositions Remotion pour Louis.
 *
 * - LouisDemo : 15s, 30fps, 16:9 (1920×1080). Boucle visuelle pour la hero
 *   de la landing publique. Frame 0 ≈ frame 450 pour un loop seamless.
 *
 *   Découpage : 0-12s identique à v2 (intro → chat → tool → réponse →
 *   DocPanel slide-in) puis 12-15s : hold sur la vue finale avec
 *   DocPanel + highlight visibles, pour laisser l'œil du spectateur
 *   absorber le résultat avant le loop.
 *
 * Render :
 *   npx remotion render LouisDemo public/hero-demo.mp4 --codec=h264 --crf=23
 *   npx remotion still LouisDemo public/hero-poster.jpg --frame=380
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LouisDemo"
        component={LouisDemo}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="LouisOg"
        component={LouisOg}
        durationInFrames={1}
        fps={30}
        width={1200}
        height={630}
      />
    </>
  );
};
