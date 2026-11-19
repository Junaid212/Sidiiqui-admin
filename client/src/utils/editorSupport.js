// editorSupport.js - what the VISUAL chapter editor (Tiptap) cannot keep.
// Tested against the real editor engine: it keeps paragraphs, headings H2-H4, bold/italic/underline/strike, lists, quotes, links, images,
// horizontal rules and TABLES (cells, header cells, merged cells). It FLATTENS to plain text (the words stay, the structure goes):
// picture frames with captions (figure/figcaption), boxes made of div, highlighted text (mark), superscript/subscript, table captions,
// span styling and headings other than H2-H4. The HTML view keeps every one of these exactly, so it is the safe place to add links
// to a chapter that has them.
export function visualEditorLoss(html, parse) {
    const doc = (parse || ((h) => new DOMParser().parseFromString(h, 'text/html')))(`<body>${html || ''}</body>`);
    const n = (sel) => doc.querySelectorAll(sel).length;
    const kinds = [
        { label: 'picture frames with captions', n: n('figure, figcaption') },
        { label: 'boxes (div blocks)', n: n('div') },
        { label: 'highlighted text', n: n('mark') },
        { label: 'superscript or subscript', n: n('sup, sub') },
        { label: 'table captions', n: n('table > caption') },
        { label: 'text styling (span)', n: n('span') },
        { label: 'headings other than H2 to H4', n: n('h1, h5, h6') },
    ].filter((k) => k.n > 0);
    return { total: kinds.reduce((s, k) => s + k.n, 0), kinds };
}

export const describeLoss = (loss) => loss.kinds.map((k) => `${k.n} ${k.label}`).join(', ');
