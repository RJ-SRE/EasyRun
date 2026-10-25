import { EXPEDITION } from "./expedition-data.js";
const integer = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
const list = (a, length, max) =>
  Array.from({ length }, (_, i) => integer(a?.[i], max));
// This migrates only adventure state. The existing word pool, outcomes and
// history remain in InscriptionBook and are never cleared by map migration.
export function expeditionSnapshot(snapshot) {
  const s = snapshot || {},
    current = s.expedition?.revision === 2;
  const checkpoint = current
    ? integer(s.checkpoint, 14)
    : [0, 3, 6, 12, 14][integer(s.checkpoint, 4)];
  const cp = s.segment === 2 ? 14 : checkpoint;
  if (current) {
    const e = s.expedition;
    return {
      ...s,
      checkpoint: cp,
      expedition: {
        revision: 2,
        flags: list(e.flags, 15, 31),
        done: list(e.done, 15, 1),
        sides: list(e.sides, 5, 2),
        cargoChoice: integer(e.cargoChoice, 2),
        mirrorChoice: integer(e.mirrorChoice, 2),
        recordChoice: integer(e.recordChoice, 2),
        lampStep: integer(e.lampStep, 3),
      },
    };
  }
  const flags = Array(15).fill(0);
  if (s.cityWind) flags[2] = 3;
  if (s.cityForge) flags[3] = 7;
  if (s.cityArchive) flags[6] = 1;
  if (s.cityMirror) flags[11] = 3;
  return {
    ...s,
    checkpoint: cp,
    cityDepth: -EXPEDITION.rooms[cp].top,
    migrated: true,
    expedition: {
      revision: 2,
      flags,
      done: Array.from({ length: 15 }, (_, i) => +(i < cp || s.segment === 2)),
      sides: Array(5).fill(0),
      cargoChoice: s.cityWind ? 1 : 0,
      mirrorChoice: s.cityMirror ? 1 : 0,
      recordChoice: 0,
      lampStep: cp > 7 ? 3 : 0,
    },
  };
}
export function expeditionHost(e) {
  return `hostRoomFlags=[]int{${e.flags.join(",")}}; hostRoomDone=[]int{${e.done.join(",")}}; hostSideProgress=[]int{${e.sides.join(",")}}; hostCargoChoice=${e.cargoChoice}; hostMirrorChoice=${e.mirrorChoice}; hostRecordChoice=${e.recordChoice}; hostLampStep=${e.lampStep}`;
}
export function parseExpedition(values) {
  if (values.length !== 45 || !values.every(Number.isFinite)) return null;
  const [
    room,
    prompt,
    lampStep,
    lampMoving,
    lampX,
    lampY,
    cargoChoice,
    mirrorChoice,
    recordChoice,
    trialHooks,
  ] = values;
  return {
    revision: 2,
    room,
    prompt,
    lampStep,
    lampMoving,
    lampX,
    lampY,
    cargoChoice,
    mirrorChoice,
    recordChoice,
    trialHooks,
    flags: values.slice(10, 25),
    done: values.slice(25, 40),
    sides: values.slice(40, 45),
  };
}
