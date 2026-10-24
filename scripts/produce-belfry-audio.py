"""Original local neural performances; no OS TTS, external voices or secrets.

Run with .tools/audio-venv/bin/python. Models and dependencies stay in .cache/.tools.
Use --auditions to produce the alternate directed takes after the release pack.
Every selected WAV is retained at the model's native sample rate.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROD = ROOT / "production/audio-v06"
OUT = ROOT / "prototypes/runlab/public/audio/v06"
MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-4bit"
REVISION = "5c390979e4b93af5f2932f90742ca99c7dd04687"


def main():
    if json.loads((PROD / "voice-brief.json").read_text())["status"] == "production_paused_by_user":
        print("Character voice production is paused by the user; no generation started.")
        return
    parser = argparse.ArgumentParser()
    parser.add_argument("--auditions", action="store_true")
    parser.add_argument("--only", default="")
    args = parser.parse_args()
    import mlx.core as mx
    import numpy as np
    import soundfile as sf
    from mlx_audio.tts.utils import load_model

    brief = json.loads((PROD / "voice-brief.json").read_text())
    script = json.loads((PROD / "dialogue.en-zh.json").read_text())
    casts = {"hero": brief["hero"], **brief["enemies"]}
    OUT.mkdir(parents=True, exist_ok=True)
    masters = PROD / "masters"
    masters.mkdir(exist_ok=True)
    record_path = PROD / "production-log.json"
    records = json.loads(record_path.read_text()) if record_path.exists() else {}
    jobs = []
    for line in script["lines"]:
        cast = casts[line["speaker"]]
        prompt = cast["casting_prompt_en"] + " Performance direction: " + line["delivery_zh"]
        jobs.append((line["id"], line["speaker"], line["text_en"], prompt, "selected", None))
        if args.auditions and line["audition"]:
            for take in ("B", "C"):
                jobs.append((line["id"] + "-take-" + take, line["speaker"], line["text_en"],
                             prompt + " Alternate interpretation: " + cast["take_directions"][take], take, None))
    if args.auditions:
        for line in script["lines"]:
            if line["id"] in ("v6-h-arrival", "v6-h-core"):
                jobs.append((line["id"] + "-cast-B", "hero", line["text_en"],
                             "An original adult male with a warmer, youthful middle register and a gentle Irish inflection. "
                             "Quiet, watchful, intimate, dry recorded speech, subtle affection, no narration. " + line["delivery_zh"],
                             "alternate_cast", None))
    cues = json.loads((PROD / "efforts-sfx.json").read_text())
    effort_text = {
        "effort-light": ("Hh.", "A single short, unvoiced athletic exhale, not a word."),
        "effort-heavy": ("Huh!", "A brief closed-mouth forceful exertion with the breath, never a battle cry."),
        "effort-grapple": ("Hnh.", "A short strained grunt while supporting body weight, natural effort."),
        "effort-land": ("Uh.", "A quiet short expelled breath when landing, physical weight."),
        "effort-hurt": ("Ah!", "A sudden brief pained breath, startled and restrained, not theatrical."),
        "effort-recover": ("Hah... hah.", "Two quiet uneven tired breaths settling down, no spoken words."),
    }
    for cue in cues["cues"]:
        if cue["id"] in effort_text:
            syllable, direction = effort_text[cue["id"]]
            for v in range(cue["variant_count"]):
                jobs.append((f"{cue['id']}-{v+1}", "hero", syllable,
                             casts["hero"]["casting_prompt_en"] + " " + direction,
                             f"body-{v+1}", cue["target_duration_seconds"][1]))
        if cue["id"].startswith("enemy-vocal-"):
            speaker = cue["id"].removeprefix("enemy-vocal-")
            for action in cue["actions"]:
                for v in range(cue["variants_per_action"]):
                    syllable = {"tell": "Hh...", "hurt": "Ah!", "collapse": "Ah..."}[action]
                    jobs.append((f"{cue['id']}-{action}-{v+1}", speaker, syllable,
                                 casts[speaker]["casting_prompt_en"] + " Nonverbal vocal gesture only: "
                                 + casts[speaker]["vocal_gestures"][{"collapse": "death"}.get(action, action)]
                                 + " No intelligible speech, no music.", f"{action}-{v+1}",
                                 0.6 if action != "collapse" else 1.3))
    jobs = [j for j in jobs if not args.only or args.only in j[0]]
    remaining = [j for j in jobs if not (j[0] in records and (masters / (j[0]+".wav")).exists() and (OUT / (j[0]+".m4a")).exists())]
    print(f"{len(remaining)} performances remaining", flush=True)
    if not remaining:
        return
    model = load_model(str(ROOT / ".cache/audio-model"))
    for ident, speaker, text, prompt, take, max_body in remaining:
        seed = 2100 + list(casts).index(speaker) * 103
        if take != "selected":
            seed += int(hashlib.sha256(ident.encode()).hexdigest()[:4], 16)
        mx.random.seed(seed)
        started = time.time()
        print("Generating", ident, flush=True)
        chunks = list(model.generate_voice_design(text=text, instruct=prompt, language="English",
                                                 temperature=0.65, top_p=0.9, max_tokens=420,
                                                 repetition_penalty=1.08, verbose=False))
        audio = np.concatenate([np.asarray(c.audio) for c in chunks]).reshape(-1)
        sr = chunks[0].sample_rate
        if not np.all(np.isfinite(audio)) or np.max(np.abs(audio)) < 0.005:
            raise RuntimeError("Silent/invalid generation " + ident)
        # Remove leading/trailing silence, retaining natural consonant and breath tails.
        active = np.flatnonzero(np.abs(audio) > 0.003)
        audio = audio[max(0, active[0]-int(sr*.08)):min(len(audio), active[-1]+int(sr*.16))]
        # Nonverbal samples are intentionally edited gestures. Keep the source as well.
        sf.write(masters / (ident+".wav"), audio, sr, subtype="PCM_24")
        runtime = audio
        if max_body and len(runtime) > sr * max_body:
            # Take a continuous gesture around its strongest local energy, not pitch-shifted speech.
            energy = np.convolve(runtime**2, np.ones(int(sr*.04))/int(sr*.04), mode="same")
            start = max(0, int(np.argmax(energy)) - int(sr*max_body*.35))
            runtime = runtime[start:start+int(sr*max_body)].copy()
        fade = min(int(sr*.012), len(runtime)//4)
        runtime[:fade] *= np.linspace(0, 1, fade)
        runtime[-fade:] *= np.linspace(1, 0, fade)
        temp = ROOT / ".cache/audio-runtime.wav"
        sf.write(temp, runtime, sr, subtype="PCM_24")
        filters = "highpass=f=65,loudnorm=I=-20:TP=-3:LRA=11"
        if max_body:
            gain = 0.32 / max(float(np.max(np.abs(runtime))), 0.01)
            filters = f"highpass=f=80,volume={gain:.5f},alimiter=limit=0.5:level=false"
        subprocess.run(["/opt/homebrew/bin/ffmpeg", "-v", "error", "-y", "-i", str(temp),
                        "-af", filters, "-ar", str(sr), "-c:a", "aac", "-b:a", "96k", str(OUT/(ident+".m4a"))], check=True)
        records[ident] = dict(speaker=speaker, text=text, prompt=prompt, take=take, seed=seed,
                             model=MODEL, revision=REVISION, engine="mlx-audio==0.6.1",
                             native_sample_rate=sr, master_duration=round(len(audio)/sr,3),
                             duration=round(len(runtime)/sr,3), file=f"/audio/v06/{ident}.m4a",
                             sha256=hashlib.sha256((OUT/(ident+".m4a")).read_bytes()).hexdigest(),
                             generated_seconds=round(time.time()-started,1), kind="vocal" if max_body else "dialogue")
        record_path.write_text(json.dumps(records, ensure_ascii=False, indent=2)+"\n")
        print("Saved", ident, records[ident]["duration"], "seconds in", records[ident]["generated_seconds"], flush=True)
        mx.clear_cache()


if __name__ == "__main__":
    main()
