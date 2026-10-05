import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const windows = process.platform === 'win32'
const javaHome = process.env.JAVA_HOME
const java = javaHome ? path.join(javaHome, 'bin', windows ? 'java.exe' : 'java') : 'java'
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '')
if (javaHome && !fs.existsSync(java)) throw new Error('JAVA_HOME does not point to a JDK directory containing bin/java. Use Android Studio\'s bundled JDK or a compatible installed JDK.')
if (spawnSync(java, ['-version'], { stdio: 'ignore' }).status !== 0) throw new Error('A working JDK is required. See docs/ANDROID.md.')
if (!sdk || !fs.existsSync(path.join(sdk, 'platforms', 'android-36'))) throw new Error('Android SDK Platform 36 is missing. Install it with Android Studio and set ANDROID_HOME. See docs/ANDROID.md.')

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: windows })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
run(windows ? 'npm.cmd' : 'npm', ['run', 'build'])
run(windows ? 'npx.cmd' : 'npx', ['cap', 'sync', 'android'])
fs.writeFileSync('android/local.properties', `sdk.dir=${sdk.replaceAll('\\', '/').replaceAll(':', '\\:')}\n`)
run(windows ? 'gradlew.bat' : './gradlew', ['assembleDebug'], path.resolve('android'))
console.log('APK: android/app/build/outputs/apk/debug/app-debug.apk')
