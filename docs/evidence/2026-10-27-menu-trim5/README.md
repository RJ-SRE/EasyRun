# v0.15.9 · 菜单音乐裁去前 5 秒

2026-10-27。只裁剪菜单曲目 Sea Power《Red Rock Riviera》的前 5 秒；桌面原件与项目内完整副本保留。本次本地交付，未推送 GitHub，未上传用户线上工程。

网页使用 `red-rock-riviera-trim5.mp3`，原生包使用同一文件的字节作为 `BGM_Menu/sound.mp3`。因此初次播放及后续循环都从裁剪后的开头开始。默认音乐音量 75%，没有额外增加淡入、淡出或改变录音响度。游戏和结束曲目不变。

## 裁剪与文件校验

按 44.1 kHz 采样率移除开头 220,500 个双声道采样帧，重置时间戳，使用 320 kbps MP3 编码。重编码用于准确落在 5.000 秒处，避免 MP3 帧边界造成近似裁剪。复现命令（输出存在时不会覆盖）：

```sh
ffmpeg -nostdin -hide_banner -loglevel error -n \
  -i '/Users/rj/Desktop/Sea Power - Red Rock Riviera.mp3' \
  -map 0:a:0 -af 'atrim=start_sample=220500,asetpts=PTS-STARTPTS' \
  -c:a libmp3lame -b:a 320k -ar 44100 -ac 2 -map_metadata 0 \
  -id3v2_version 3 -metadata comment='Menu edit: first 5.000 seconds removed' \
  prototypes/runlab/public/audio/music/red-rock-riviera-trim5.mp3
```

[解码校验](audio-cut.json)：原文件解码 18,235,055 帧，裁剪后 18,014,555 帧，相差恰好 220,500 帧，即 5 秒。新文件时长 408.493311 秒，约 6:48；新文件开头两秒与原曲第 5 秒起的两秒波形相关性约 0.999993。MP3 的封装时长包含帧填充，以实际解码帧数验证裁剪长度。

- 裁剪音频：16,342,397 字节，SHA-256 `1e52bde9deb32b1aab99b121630d972dd4287e539dc23a100776e874a89dadb2`。
- 原桌面文件 SHA-256 仍为 `65e0b2456c0f3192595ae85ea6b87b5ada59a1a6017973abfa90935c04bba6aa`。
- 交付包：`EasyRun-XBuilder-v0.15.9-menu-trim5.xbp`，113,069,739 字节。
- 包 SHA-256：`4d1aa4da38ca3ccdebae50351624eab20a54358cadba8b8d9efac0e2b2f9ab40`。

[包校验](verification.json)确认与 v0.15.8 相比只有菜单 MP3 与音乐来源清单改变，其余代码、声音与图像字节一致，CRC 正常。原来的菜单震屏修复与深层音乐修复均保留。

## 播放验证与使用

网页 17 项、原生音频 15 项，共 32 项检查全部通过。

[网页报告](web-music.json)检查裁剪版真实时长、播放、曲尾循环、暂停续播、阶段切换、音量与资源错误恢复。[原生报告](native-audio.json)使用实际包经部署项目模型往返导出，再测量部署引擎的真实声音输出，包括深层关卡、攻击、独立音量、暂停、切歌和循环。

网页循环测试跳到裁剪文件曲尾后验证返回开头；原生循环以裁剪曲目的独立一秒片段加速测试，交付包内仍为 6:48 的裁剪版。测试夹具只存在于内存副本，不进入交付包。未替用户在线导入，也未冒充全关卡自然游玩验收。

网页版刷新即可加载新资源路径。XBuilder 需重新导入桌面上的新 `.xbp`，刷新旧工程不会替换里面的音频。
