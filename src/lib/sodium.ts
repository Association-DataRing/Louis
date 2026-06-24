import sodiumLib from "libsodium-wrappers-sumo";

let initDone = false;

export async function getSodium(): Promise<typeof sodiumLib> {
  if (!initDone) {
    await sodiumLib.ready;
    initDone = true;
  }
  return sodiumLib;
}
