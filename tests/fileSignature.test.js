import { describe, it, expect } from "vitest";
import { sniffFileSignature } from "../src/middlewares/fileSignature.middleware.js";

describe("sniffFileSignature", () => {
  it("detects jpeg", () => {
    expect(sniffFileSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg"
    );
  });

  it("detects png", () => {
    expect(
      sniffFileSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe("image/png");
  });

  it("detects webvtt", () => {
    expect(sniffFileSignature(Buffer.from("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHi"))).toBe(
      "text/vtt"
    );
  });

  it("detects mp4 ftyp", () => {
    const buf = Buffer.alloc(16);
    buf.writeUInt32BE(0, 0);
    buf.write("ftyp", 4);
    buf.write("isom", 8);
    expect(sniffFileSignature(buf)).toBe("video/mp4");
  });

  it("returns null for unknown", () => {
    expect(sniffFileSignature(Buffer.from("not a real file!!!"))).toBeNull();
  });
});
