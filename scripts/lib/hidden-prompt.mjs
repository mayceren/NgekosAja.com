import {RepairError} from './owned-auth-account.mjs';

export function hiddenPrompt(label, input = process.stdin, output = process.stdout) {
  if (!input.isTTY || !output.isTTY) throw new RepairError('Jalankan di terminal VS Code interaktif. Jangan masukkan password melalui argumen, file, atau chat.');
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = !!input.isRaw;
    output.write(label);
    input.setRawMode(true);
    input.setEncoding('utf8');
    input.resume();
    const cleanup = () => {input.off('data', onData); input.setRawMode(wasRaw); input.pause(); output.write('\n');};
    const onData = chunk => {
      // Ignore terminal navigation sequences; never echo secret characters.
      for (const char of chunk.replace(/\u001b\[[0-9;]*[A-Za-z~]/g, '')) {
        if (char === '\u0003' || char === '\u0004') {value = ''; cleanup(); reject(new RepairError('Dibatalkan. Tidak ada password yang dikirim.')); return;}
        if (char === '\r' || char === '\n') {const secret = value; value = ''; cleanup(); resolve(secret); return;}
        if (char === '\u007f' || char === '\b') {value = Array.from(value).slice(0, -1).join(''); continue;}
        if (char === '\u0015') {value = ''; continue;}
        if (char >= ' ' && char !== '\u007f') value += char;
      }
    };
    input.on('data', onData);
  });
}
