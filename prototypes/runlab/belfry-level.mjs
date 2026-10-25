// World coordinates: x grows right, y grows up. One shared source for art,
// collision and route tests; every climb has permanent anchors within 470 px.
export const platforms = [
  [80, 280, 0, 0],
  [650, 230, -250, 0],
  [100, 440, -500, 0],
  [580, 250, -770, 1],
  [80, 320, -1050, 0],
  [480, 400, -1300, 0],
  [100, 230, -1560, 1],
  [570, 260, -1830, 0],
  [560, 320, -2100, 0],
  [80, 260, -2360, 0],
  [600, 250, -2630, 1],
  [100, 460, -2890, 0],
  [80, 300, -3150, 0],
  [480, 400, -3150, 0],
  [80, 800, -3590, 0],
  [80, 800, -1120, 2],
  [80, 800, -2230, 3],
  [355, 200, -1360, 5], // counterweight lift, powered at the foundry
  [335, 280, -2740, 4], // aligned mirror bridge
  [340, 220, -1960, 6], // archive service shelf revealed by draining
  [100, 190, -3410, 0], // Keeper's left upper footing; permanent grapple route
  [670, 190, -3410, 0], // opposite footing supports the hunter/core forms
];
export const anchors = [
  [300, 140],
  [560, -100],
  [350, -340],
  [600, -580],
  [350, -820],
  [570, -1060],
  [360, -1300],
  [600, -1540],
  [350, -1780],
  [560, -2020],
  [350, -2260],
  [600, -2500],
  [350, -2740],
  [580, -2980],
  [300, -3230],
  [660, -3230],
  [480, -3440],
];
// kind: 0 hovering knives, 1 martial shortblade, 2 wall archer,
// 3 assassin keeper (boss), 4 chain hunter, 5 close grappling binder.
// Grounded enemy centers sit 34 px above their supporting platform.
export const enemies = [
  [540, -360, 0],
  [280, -466, 1],
  [670, -1086, 1],
  [848, -940, 2],
  [720, -1266, 5],
  [430, -1700, 0],
  [300, -2196, 4],
  [112, -2020, 2],
  [270, -2856, 5],
  [670, -3116, 4],
  [480, -3556, 3],
  [570, -2780, 0, 1],
  [848, -2440, 2, 1],
  [630, -1266, 4, 1],
  [430, -620, 0, 1],
];
export const echoes = [
  [760, -210],
  [190, -1515],
  [770, -2585],
];
export const checkpoints = [
  [230, 0],
  [230, -1050],
  [720, -2100],
  [230, -3150],
  [480, -3590],
];
