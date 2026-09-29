import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'START-PRESENTATION.cmd'], {cwd:root,stdio:'inherit',windowsHide:false});
child.on('error', e => {console.error(e.message);process.exitCode=1;});
child.on('exit', code => {process.exitCode=code ?? 1;});
