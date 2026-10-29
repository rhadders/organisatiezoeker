import "server-only";

/** Tekst uit een pdf (ANBI-formulier, jaarverslag). Beperkt tot de eerste 12 pagina's. */
export async function pdfToText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({ last: 12 });
    return (result.text ?? "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
