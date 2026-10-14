// File: desktop/helper/build.js
// Compiles FlowHelper.cs with the C# compiler that ships with Windows
// (.NET Framework 4.x), so no Visual Studio or .NET SDK is required.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const here = __dirname;
const source = path.join(here, 'FlowHelper.cs');
const outDir = path.join(here, 'bin');
const output = path.join(outDir, 'FlowHelper.exe');

if (process.platform !== 'win32') {
  console.log('[helper] Skipping FlowHelper build: it is Windows-only.');
  process.exit(0);
}

const windir = process.env.WINDIR || 'C:\\Windows';
const framework = ['Framework64', 'Framework']
  .map((dir) => path.join(windir, 'Microsoft.NET', dir, 'v4.0.30319'))
  .find((dir) => fs.existsSync(path.join(dir, 'csc.exe')));
if (!framework) {
  console.error('[helper] csc.exe (.NET Framework 4.x) was not found; global shortcuts will be unavailable.');
  process.exit(0);
}

// Skip the rebuild when the exe is newer than the source.
if (fs.existsSync(output) && fs.statSync(output).mtimeMs >= fs.statSync(source).mtimeMs && !process.argv.includes('--force')) {
  console.log('[helper] FlowHelper.exe is up to date.');
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });
const wpf = path.join(framework, 'WPF');
const args = [
  '/nologo',
  '/target:exe',
  '/platform:anycpu',
  '/optimize+',
  `/out:${output}`,
  `/r:${path.join(wpf, 'UIAutomationClient.dll')}`,
  `/r:${path.join(wpf, 'UIAutomationTypes.dll')}`,
  `/r:${path.join(wpf, 'WindowsBase.dll')}`,
  source,
];
try {
  execFileSync(path.join(framework, 'csc.exe'), args, { stdio: 'inherit' });
  console.log(`[helper] Built ${path.relative(process.cwd(), output)}`);
} catch {
  console.error('[helper] Compiling FlowHelper.cs failed (see errors above).');
  process.exit(1);
}
