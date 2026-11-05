# GET /api/tts?t=<word>[&slow=1] → mp3 of the word, same voice as audio/ (scripts/make_audio.py).
# For words that have no pre-generated mp3: added on the site through "➕ Добавить слова".
# Every answer is cached by Vercel's CDN for a year, so each word is voiced once.
# Only short English text is accepted, so this can't be used as a general-purpose TTS service.
import asyncio
import os
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import edge_tts

VOICE = "en-US-AriaNeural"
ALLOWED = re.compile(r"^[A-Za-z0-9 ,.'’?!-]{1,80}$")


async def synth(text, slow):
    kw = {"rate": "-30%" if slow else "+0%"}
    proxy = os.environ.get("HTTPS_PROXY")  # local testing behind a proxy; unset on Vercel
    if proxy:
        kw["proxy"] = proxy
    audio = bytearray()
    async for chunk in edge_tts.Communicate(text, VOICE, **kw).stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    return bytes(audio)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        text = re.sub(r"\s+", " ", (q.get("t") or [""])[0]).strip()
        slow = (q.get("slow") or [""])[0] == "1"
        if not ALLOWED.match(text):
            return self.reply(400, b"bad text", "text/plain")
        try:
            audio = asyncio.run(synth(text, slow))
        except Exception as e:  # Microsoft's service hiccup — the browser falls back to its own voice
            return self.reply(502, str(e).encode()[:200], "text/plain")
        if not audio:
            return self.reply(502, b"no audio", "text/plain")
        self.reply(200, audio, "audio/mpeg", "public, max-age=31536000, s-maxage=31536000, immutable")

    def reply(self, status, body, ctype, cache="no-store"):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(body)
