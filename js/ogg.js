// WebM (Opus) → Ogg (Opus) remuxer. Chrome and Android record audio only as WebM, but Telegram shows
// a file as a voice message only when it is Ogg/Opus. The Opus packets stay as they are, only the container changes.
(function (App) {
  const MASTER = new Set([0x18538067, 0x1f43b675, 0xa0, 0x1654ae6b, 0xae]); // Segment, Cluster, BlockGroup, Tracks, TrackEntry

  // EBML variable-length integer. Ids keep their length marker, sizes don't.
  function vint(b, pos, keepMarker) {
    const first = b[pos];
    let len = 1, mask = 0x80;
    while (len <= 8 && !(first & mask)) { len++; mask >>= 1; }
    if (len > 8) throw new Error("bad EBML");
    let value = keepMarker ? first : first & (mask - 1);
    let allOnes = value === mask - 1;
    for (let i = 1; i < len; i++) {
      value = value * 256 + b[pos + i];
      if (b[pos + i] !== 0xff) allOnes = false;
    }
    return { value, len, unknown: !keepMarker && allOnes };
  }

  // Number of 48 kHz samples in one Opus packet (RFC 6716, section 3.1).
  function samples(pkt) {
    const toc = pkt[0], config = toc >> 3;
    const ms = config < 12 ? [10, 20, 40, 60][config & 3] : config < 16 ? [10, 20][config & 1] : [2.5, 5, 10, 20][config & 3];
    const c = toc & 3;
    const frames = c === 0 ? 1 : c < 3 ? 2 : pkt[1] & 0x3f;
    return frames * ms * 48;
  }

  function parseWebm(b) {
    let track = 0, head = null, channels = 1;
    const packets = [];
    let pos = 0;
    while (pos < b.length) {
      const id = vint(b, pos, true);
      const size = vint(b, pos + id.len, false);
      const start = pos + id.len + size.len;
      if (MASTER.has(id.value)) { pos = start; continue; } // flatten: their children follow right here
      if (size.unknown) throw new Error("unknown size");
      const end = start + size.value;
      if (end > b.length) break; // recording cut off mid-element
      if (id.value === 0x63a2) head = b.slice(start, end); // CodecPrivate = OpusHead
      else if (id.value === 0xd7 && !track) track = b[start]; // TrackNumber
      else if (id.value === 0x9f) channels = b[start]; // Channels
      else if (id.value === 0xa3 || id.value === 0xa1) { // SimpleBlock / Block
        const tn = vint(b, start, false);
        const flags = b[start + tn.len + 2];
        if (flags & 0x06) throw new Error("laced blocks");
        if (!track || tn.value === track) packets.push(b.subarray(start + tn.len + 3, end));
      }
      pos = end;
    }
    if (!head || String.fromCharCode(...head.subarray(0, 8)) !== "OpusHead") {
      head = new Uint8Array(19);
      head.set([79, 112, 117, 115, 72, 101, 97, 100, 1, channels, 0x38, 0x01, 0x80, 0xbb]); // 312 pre-skip, 48 kHz
    }
    return { head, packets };
  }

  const CRC = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    CRC[i] = r >>> 0;
  }
  const crc32 = (b) => { let c = 0; for (const x of b) c = ((c << 8) ^ CRC[((c >>> 24) ^ x) & 0xff]) >>> 0; return c; };

  function page(packets, granule, seq, flags) {
    const lacing = [];
    for (const p of packets) {
      for (let n = p.length; ; n -= 255) { lacing.push(Math.min(n, 255)); if (n < 255) break; }
    }
    const bodyLen = packets.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(27 + lacing.length + bodyLen);
    const v = new DataView(out.buffer);
    out.set([79, 103, 103, 83, 0, flags]); // "OggS", version, header type
    v.setUint32(6, granule % 0x100000000, true);
    v.setUint32(10, Math.floor(granule / 0x100000000), true);
    v.setUint32(14, 0x766f6361, true); // stream serial
    v.setUint32(18, seq, true);
    out[26] = lacing.length;
    out.set(lacing, 27);
    let o = 27 + lacing.length;
    for (const p of packets) { out.set(p, o); o += p.length; }
    v.setUint32(22, crc32(out), true);
    return out;
  }

  App.webmToOgg = (buffer) => {
    const { head, packets } = parseWebm(new Uint8Array(buffer));
    if (!packets.length) throw new Error("no audio");
    const vendor = new TextEncoder().encode("my-english-vocab");
    const tags = new Uint8Array(8 + 4 + vendor.length + 4);
    tags.set(new TextEncoder().encode("OpusTags"));
    new DataView(tags.buffer).setUint32(8, vendor.length, true);
    tags.set(vendor, 12);

    const pages = [page([head], 0, 0, 0x02), page([tags], 0, 1, 0)];
    let granule = 0, batch = [], segs = 0;
    packets.forEach((p, i) => {
      const need = Math.floor(p.length / 255) + 1;
      if (segs + need > 255) { pages.push(page(batch, granule, pages.length, 0)); batch = []; segs = 0; }
      batch.push(p);
      segs += need;
      granule += samples(p);
      if (i === packets.length - 1) pages.push(page(batch, granule, pages.length, 0x04));
    });
    return new Blob(pages, { type: "audio/ogg" });
  };
})(window.App);
