// Authored design data, not imported by the playable game.
import { WORDS } from '../../../prototypes/runlab/public/cet4-words.js';
import { writeFile } from 'node:fs/promises';
const bank = new Map(WORDS.map(w=>[w.id,w]));
const chapters = [
 ['gate','风钟门','看懂落点，再选择速度','#9fb5bd',['R01','R02','S01']],
 ['forge','铸钟炉','改造机关，改变战场','#c88a59',['R03','R04','S02']],
 ['archive','沉水档案','搜索证据，走出不同路线','#72aca5',['R05','R06','S03']],
 ['mirror','碎镜唱廊','分辨信息，破解假动作','#c6c1d5',['R07','R08','S04']],
 ['heart','守心机枢','综合运用，带着选择撤离','#d2b76e',['R09','R10','S05']],
].map(([id,name,verb,color,rooms])=>({id,name,verb,color,rooms}));
const rooms = [
 ['R01','gate','断阶前庭','main',90,0,'下潜 / 单次换壁','先读落点，再跳入宽安全平台','无敌人 → 单悬刃','失败落到补救台；普通跳跃和固定锚点始终可走','旗布和摆钟指出风向；光圈只标可抓锚点'],
 ['R02','gate','风铃哨廊','main',110,0,'错层射线 / 近身反制','选高路缩短距离，选低路获得掩体','壁弓 + 短锋，错开起手','箭可斩；下层有保底通路','高处铃铛先震后响；低处石栏轮廓稳定'],
 ['S01','gate','折返信使','side',120,0,'短距离追逐 / 分岔','追上运送旧信的机械匣，或绕路截获','一悬刃，禁止控制怪','追丢匣子仍从支路出口回主线，不锁门','空绳与磨损投递口暗示失去收件人的职责'],
 ['R03','forge','双秤井','main',100,0,'配重 / 摆渡','先选稳定落点或快速摆渡，再操作配重','单缚索，落点附近永久锚点','误答保持旧配重状态；手动绕行始终存在','两只巨型钟模一升一降，承重链与装饰链明显分开'],
 ['R04','forge','落锤炉膛','main',120,1,'定时穿越 / 借地形破防','把落锤诱到敌人处，或先停锤稳打','短锋 + 壁弓，不同时夹射','停锤失败不改已有周期；预警至少一次完整循环','热区铺地纹，落锤有拉紧、阴影、落下三段预警'],
 ['S02','forge','最后的修钟人','side',140,1,'护送 / 路线改造','保护维修傀儡跨越两段断桥，不是原地站桩','两波各一名短锋','护送失败失去支路奖励，不能导致主线失败','工具箱与空制服体现职责；奖励是捷径与工具纹样'],
 ['R05','archive','退潮书库','main',95,0,'搜索 / 高低路线','读水位刻度，选择干燥长路或短促低路','壁弓仅守一条射线','低路失误回到干路台，不设英语氧气倒计时','水面为预烘纹理与局部倒影，不做全屏实时折射'],
 ['R06','archive','证物升降间','main',125,1,'调查 / 机关重组','两件物证确定真正可用升降机，再自由选择战术','封脉单独出现于至少260单位宽平台','不用词也可沿固定锚点上行；控制最久0.7秒后给物理解法','空台座与磨损轨迹可核验，不靠猜作者意图'],
 ['S03','archive','被封存的航路','side',150,1,'遗迹拼合 / 钩索接力','恢复旧航路图并实际走一段映射路线','悬刃一名；环境回声替代对白','拼合错保留已验证证据；回到最近安全台','琉璃匣投出局部路线光，词义展示仍清晰可读'],
 ['R07','mirror','两面回廊','main',95,0,'真假路线 / 视角辨识','看连接关系区分实体桥和镜中倒影','壁弓本体 + 无碰撞残像','残像不能造成伤害；结构轮廓是非颜色线索','真物有实体挂链与阴影；镜面边缘缺角'],
 ['R08','mirror','错拍决斗场','main',105,0,'一对一决斗 / 预判','看脚步而不是亮光判断撤步、扫腿和飞踢','短锋精英，无新增敌种','假动作只改变表现，真实命中前保留明确前摇','薄银面甲、单边镜片，破绽用姿势加暖色边缘'],
 ['S04','mirror','另一条归路','side',160,1,'风险选择 / 路线开关','判断哪条遗迹记录可信，打开一条返程便道','缚索或封脉二选一，不能并置','错读不开捷径；主返程保留；不扣词汇历史','破碎镜框对应地图缺口，拒绝整屏镜像翻转'],
 ['R09','heart','双钟锁心室','main',180,1,'双阶段Boss / 破锁连携','先拉钟锁再引诱冲刺，贯夜接断潮；用已见词反制','守心者；第二阶段只添一种已教会的变化','Boss不得出新词；答错仍恢复动作；门由战斗目标开启','暖金心脏、黑金属轮廓；攻击预警盖过装饰光'],
 ['S05','heart','未寄出的愿望','side',190,1,'环境叙事 / 战术取舍','取出或留下旧城愿望匣，选择返程补给或捷径','一轮双敌，控制怪不与区域攻击同时出现','两种叙事选择都合法；英语只有语义对错，没有道德标准答案','无人物对白，以空座、挂绳、熄灯与物件变化收束'],
 ['R10','heart','倒钟归途','main',130,1,'向上追逐 / 旧路变体','走已打开便道或永久锚点，在安全肩台解读撤离指令','悬刃 + 壁弓依次出现','黑潮紧逼时禁止新题；未完成词不锁出口；错题回收至下一局','之前静止的钟体逆转，灯由下往上熄灭，锚点始终可见'],
].map(([id,chapter,name,route,seconds,reviews,shape,objective,enemies,fallback,art])=>({id,chapter,name,route,seconds,reviews,shape,objective,enemies,fallback,art}));
const rows = [
 ['climb','R01','route','Climb the inner wall.','内壁永久锚点路线','Climb above the rising water.','R10 / 下一局'],
 ['follow','R01','route','Follow the bells.','读懂指引后自己选择是否跟随铃路','Follow the moving light.','S03 / 下一局'],
 ['narrow','R02','route','A narrow passage lies below.','识别窄缝路线，权衡掩体与空间','The narrow bridge has no cover.','R07 / 下一局'],
 ['reach','R02','combat','Reach the far platform.','利用击退与钩索落到对岸','Reach the upper anchor.','R10 / 下一局'],
 ['danger','S01','story','Danger ahead.','辨读危险区后选择绕行或追逐','The danger comes from above.','R04 / 下一局'],
 ['journey','S01','story','The journey is not over.','旧信显示尚未完成的运送职责','The return journey begins here.','R10 / 下一局'],
 ['repair','R03','machine','Repair the lift.','修复辅助升降机；固定锚点仍可通行','Repair the broken bridge.','R10 / 下一局'],
 ['energy','R03','machine','The lift needs energy.','选把有限能量送给摆渡台或掩体','Save energy for the upper gate.','R10 / 下一局'],
 ['balance','R04','machine','Keep your balance.','辨义后校准配重，玩家仍需判断起跳','The balance between the weights has changed.','R10 / 下一局'],
 ['protect','R04','combat','Protect the lower bridge.','强化反制以保留掩体；不自动杀敌','Protect the repair machine.','S02 / 下一局'],
 ['enable','S02','machine','Enable the service lift.','启用傀儡的备用运输装置','Enable the upper route.','S04 / 下一局'],
 ['limit','S02','machine','The lift has a load limit.','读懂承重限制并决定运货顺序','There is a limit to the shield.','R09 / 下一局'],
 ['search','R05','route','Search the dry shelves.','通过线索定位可互动书架','Search behind the broken mirror.','S04 / 下一局'],
 ['memory','R05','story','A memory remains in the glass.','激活残响，认出曾经的水位','This memory shows another route.','S04 / 下一局'],
 ['evidence','R06','story','The marks are evidence of movement.','把磨损痕迹与升降机的位置对应','There is no evidence behind the claim.','R07 / 下一局'],
 ['reveal','R06','machine','Reveal the hidden supports.','局部照明显示承重结构，不替玩家寻路','Reveal the keeper\'s weak point.','R09 / 下一局'],
 ['ancient','S03','story','An ancient map hangs above.','辨认旧航路图的年代与用途','An ancient order binds the keeper.','S05 / 下一局'],
 ['notice','S03','route','Notice the missing link.','识别链条缺口并找固定锚点补位','Notice the change in its stance.','R08 / 下一局'],
 ['trust','R07','story','Trust the supports, not the reflection.','用可核验证据判断路线，不按颜色猜答案','Trust the route you repaired.','R10 / 下一局'],
 ['doubt','R07','story','There is doubt about the old map.','查验第二条线索，不凭一句话判真假','The broken seal leaves room for doubt.','S05 / 下一局'],
 ['contrast','R08','combat','Notice the contrast between the two stances.','识别假起手和真实落脚点后反制','The contrast reveals a hidden doorway.','S04 / 下一局'],
 ['aware','S04','route','Be aware of the moving floor.','在安全观察台读懂警示再起步','Be aware of the returning chain.','R09 / 下一局'],
 ['ignore','S04','story','Ignore the reflected light.','排除无碰撞残像的误导','Ignore the empty signal.','R10 / 下一局'],
 ['choice','S04','story','The choice changes the return route.','解锁二选一战术，选择本身不判英语对错','Every choice has a cost.','S05 / 下一局'],
 ['resist','R09','combat','Resist the pull of the chain.','用已见词强化解链，仍可J/E物理解控','Resist the current.','R05 / 下一局'],
 ['escape','R10','route','Escape through the upper shaft.','读懂撤离方向，真正攀升仍靠操作','Escape from the closing chamber.','R03 / 下一局'],
 ['purpose','R09','story','The keeper has forgotten its purpose.','战前安全台读残响，战斗中不弹长文本','What is the purpose of this machine?','R03 / 下一局'],
 ['freedom','S05','story','The machine has never known freedom.','理解旧匣记录后自主决定是否释放它','Freedom comes with a difficult choice.','S04 / 下一局'],
 ['consequence','S05','story','The consequence appears on the return journey.','明确展示选择改变哪处捷径，不设道德标准答案','A broken bridge is one consequence of the collapse.','R10 / 下一局'],
 ['persist','S05','combat','Persist despite the broken path.','完成有补救台的连续钩索挑战','Persist through the final climb.','R10 / 下一局'],
];
const words=rows.map(([id,room,role,firstContext,use,returnContext,revisit])=>({id,word:bank.get(id)?.word,pos:bank.get(id)?.pos,meaning:bank.get(id)?.meaning,tier:bank.get(id)?.tier,room,role,firstContext,use,returnContext,revisit,source:'existing ECDICT CET-4 curated bank',status:'authored design example; contextual sentences await independent language review'}));
const reviewWords={R04:'reach',R06:'energy',R09:'reveal',R10:'repair',S02:'narrow',S03:'follow',S04:'evidence',S05:'choice'};
for (const [room,id] of Object.entries(reviewWords)) {const w=words.find(w=>w.id===id); if(!w.revisit.includes(room)) w.revisit=room+' / '+w.revisit;}
const data={reviewWords,version:'design-0.8-proposal',baseline:'61a6a64',status:'planning only; not shipped gameplay',chapters,rooms,words,mainRoute:['R01','R02','R03','R04','R05','R06','R07','R08','R09','R10'],fullRoute:['R01','R02','S01','R03','R04','S02','R05','R06','S03','R07','R08','S04','S05','R09','R10'],cadence:{maxIn90Seconds:2,minActionGap:25,nominalPromptGap:46,fullPromptCap:42,reviewMain:4,reviewFull:8}};
await writeFile(new URL('design-data.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
const table=['# 30 词样例：具体用途与复遇语境','','这是可评审样例池，不取代正式随机抽词。30 词均已存在于当前词库；新句子和机关义项仍须独立语言审校。复遇列是可调用的内容库，**不代表一局强行完成全部 30 次复遇**。本局仅按预算选 4 / 8 次，其他进入后续同词组远征。','','| 词 / 目标义项 | 首次房间 | 原文语境 | 玩法用途 | 不同语境的复遇 |','| --- | --- | --- | --- | --- |',...words.map(w=>`| ${w.word} · ${w.pos} ${w.meaning} | ${w.room} | ${w.firstContext} | ${w.use} | ${w.returnContext}（${w.revisit}） |`),'','抽象词在证据、残响和选择中出现；不把 freedom 机械解释成“飞行魔法”，也不把 balance 的名词义项冒充动词。'].join('\n');
await writeFile(new URL('WORDS.md',import.meta.url),table+'\n');
