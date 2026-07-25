#!/usr/bin/env python
"""
fasterWhisperTranscribe.py
---------------------------------
Transcribes an audio file with faster-whisper (CTranslate2) and prints a
single flat JSON object to stdout:

    {"words": [{"word": "...", "start": 0.0, "end": 0.42}, ...]}

This replaces the old `python -m whisperx ... --output_format json
--output_dir <dir>` invocation used by whisperAlign.mjs. faster-whisper's
own `word_timestamps=True` decoding gives per-word timing directly, so
there's no separate forced-alignment pass and no JSON file written to
disk for the caller to read back in — it's piped straight over stdout.

Requires: pip install faster-whisper
"""
import argparse
import json
import sys

from faster_whisper import WhisperModel


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio_path")
    parser.add_argument("--model", default="small")
    parser.add_argument("--language", default="en")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute_type", default="int8")
    args = parser.parse_args()

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    segments, _info = model.transcribe(
        args.audio_path,
        language=args.language,
        word_timestamps=True,
    )

    words = []
    for segment in segments:
        for w in segment.words or []:
            words.append({"word": w.word, "start": w.start, "end": w.end})

    json.dump({"words": words}, sys.stdout)


if __name__ == "__main__":
    main()
