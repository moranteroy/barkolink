import { Capacitor } from '@capacitor/core';

let initialized = false;
export async function initializeNativeLayout() {
  const android = Capacitor.getPlatform() === 'android';
  document.documentElement.classList.toggle('native-android', android);
  if (!android || initialized) return;
  initialized = true;
  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    await Keyboard.addListener('keyboardWillShow', () =>
      document.documentElement.classList.add('keyboard-visible'),
    );
    await Keyboard.addListener('keyboardWillHide', () =>
      document.documentElement.classList.remove('keyboard-visible'),
    );
  } catch {
    initialized = false;
  }
}
