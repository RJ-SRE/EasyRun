import { EXPEDITION } from "./expedition-data.js";
const integer = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
const list = (a, length, max) =>
  Array.from({ length }, (_, i) => integer(a?.[i], max));
// v3 changes only adventure topology. InscriptionBook owns and retains words.
export function expeditionSnapshot(snapshot) {
  const s = snapshot || {},
    rev = s.expedition?.revision;
  const cp =
    s.segment === 2
      ? 14
      : rev === 2 || rev === 3
        ? integer(s.checkpoint, 14)
        : [0, 3, 6, 12, 14][integer(s.checkpoint, 4)];
  return {
    ...s,
    checkpoint: cp,
    cityWind: 0,
    cityForge: 0,
    cityArchive: 0,
    cityMirror: 0,
    cityChoice: 0,
    cityDepth: Math.max(
      Number.isFinite(s.cityDepth) ? s.cityDepth : 0,
      -EXPEDITION.rooms[cp].top,
    ),
    migrated: rev !== 3,
    expedition: {
      revision: 3,
      flags: Array(15).fill(0),
      done:
        rev === 3
          ? list(s.expedition.done, 15, 1)
          : Array.from({ length: 15 }, (_, i) => +(i < cp)),
      sides: Array(5).fill(0),
      cargoChoice: 0,
      mirrorChoice: 0,
      recordChoice: 0,
      lampStep: 0,
    },
  };
}
export function expeditionHost(e) {
  return `hostRoomFlags=[]int{${Array(15).fill(0).join(",")}}; hostRoomDone=[]int{${e.done.join(",")}}; hostSideProgress=[]int{0,0,0,0,0}; hostCargoChoice=0; hostMirrorChoice=0; hostRecordChoice=0; hostLampStep=0`;
}
export function parseExpedition(v) {
  if (v.length !== 45 || !v.every(Number.isFinite)) return null;
  return {
    revision: 3,
    room: v[0],
    prompt: -1,
    lampStep: 0,
    lampMoving: 0,
    lampX: 0,
    lampY: 0,
    cargoChoice: 0,
    mirrorChoice: 0,
    recordChoice: 0,
    trialHooks: 0,
    flags: v.slice(10, 25),
    done: v.slice(25, 40),
    sides: Array(5).fill(0),
  };
}
