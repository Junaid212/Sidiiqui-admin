/**
 * Real JPEG detection from a file's binary content.
 *
 * A file's MIME type and extension come from its NAME, so a PNG renamed to ".jpg" looks like a JPEG
 * to the browser (and even decodes fine in an <img>). The only reliable check is the content itself:
 * every JPEG starts with the bytes FF D8 FF.
 *
 * This is instant client-side feedback only. The server independently re-checks the signature,
 * size and real dimensions and remains the final authority.
 */

/** True if the first bytes are the JPEG start-of-image signature (FF D8 FF). */
export function bytesHaveJpegSignature(bytes) {
    return !!bytes && bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
}

/** Read only the first 3 bytes of a File/Blob and check the JPEG signature. */
export async function hasJpegSignature(file) {
    if (!file || typeof file.slice !== 'function') return false;
    const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    return bytesHaveJpegSignature(head);
}
