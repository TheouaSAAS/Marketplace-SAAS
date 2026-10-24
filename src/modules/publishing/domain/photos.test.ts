import { describe, expect, it } from "vitest";
import { sniffPhotoType } from "./photos";


describe("signature réelle des fichiers", () => {
  it("reconnaît JPEG, PNG et WebP d'après leurs premiers octets", () => {
    expect(sniffPhotoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(sniffPhotoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffPhotoType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });

  it("refuse un fichier déguisé (HTML, SVG, PDF, exécutable) quel que soit son nom", () => {
    for (const text of ["<html><script>", "<svg onload=", "%PDF-1.7", "MZ\u0090\u0000"]) {
      expect(sniffPhotoType(new TextEncoder().encode(text))).toBeNull();
    }
    expect(sniffPhotoType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20]))).toBeNull();
  });
});
