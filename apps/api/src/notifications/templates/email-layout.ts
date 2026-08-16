export interface EmailLayoutInput {
  preheader: string;
  eyebrow: string;
  title: string;
  introduction: string;
  contentHtml: string;
  action?: { label: string; url: string };
  footerNote?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function emailLayout(input: EmailLayoutInput): string {
  const action = input.action
    ? `<tr><td style="padding:8px 32px 32px"><a href="${escapeHtml(input.action.url)}" style="display:inline-block;background:#c99a4a;color:#11100e;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;line-height:20px;padding:14px 24px;border-radius:6px">${escapeHtml(input.action.label)}</a></td></tr>`
    : '';
  const footerNote = input.footerNote
    ? `<p style="margin:0 0 10px;color:#9d978d;font-size:12px;line-height:18px">${escapeHtml(input.footerNote)}</p>`
    : '';

  return `<!doctype html>
<html lang="pt-PT">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:#080807;color:#f4f0e8">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#080807">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#121210;border:1px solid #30281c;border-radius:12px;overflow:hidden">
<tr><td style="height:4px;background:#c99a4a;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:30px 32px 18px">
<p style="margin:0 0 8px;color:#c99a4a;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${escapeHtml(input.eyebrow)}</p>
<p style="margin:0;color:#f4f0e8;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;line-height:34px">${escapeHtml(input.title)}</p>
</td></tr>
<tr><td style="padding:0 32px 20px"><p style="margin:0;color:#d5d0c7;font-family:Arial,sans-serif;font-size:15px;line-height:24px">${escapeHtml(input.introduction)}</p></td></tr>
<tr><td style="padding:0 32px 24px">${input.contentHtml}</td></tr>
${action}
<tr><td style="padding:22px 32px;background:#0d0d0b;border-top:1px solid #29251e">
${footerNote}
<p style="margin:0;color:#777268;font-family:Arial,sans-serif;font-size:11px;line-height:17px">Mensagem transacional enviada pela DonFlow.<br>&copy; ${new Date().getUTCFullYear()} DonFlow. Todos os direitos reservados.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function detailRows(
  rows: Array<{ label: string; value: string }>,
): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#191815;border:1px solid #302c24;border-radius:8px">${rows
    .map(
      (row, index) =>
        `<tr><td style="padding:${index ? '8px' : '16px'} 16px ${index === rows.length - 1 ? '16px' : '8px'};color:#9d978d;font-family:Arial,sans-serif;font-size:12px;vertical-align:top;width:110px">${escapeHtml(row.label)}</td><td style="padding:${index ? '8px' : '16px'} 16px ${index === rows.length - 1 ? '16px' : '8px'};color:#f4f0e8;font-family:Arial,sans-serif;font-size:14px;font-weight:600;line-height:20px">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('')}</table>`;
}
