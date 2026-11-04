import {beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({platform:'web',listeners:new Map<string,()=>void>(),addListener:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=>state.platform}}));
vi.mock('@capacitor/keyboard',()=>({Keyboard:{addListener:state.addListener}}));
beforeEach(()=>{
 vi.resetModules();state.platform='web';state.listeners.clear();state.addListener.mockReset();
 state.addListener.mockImplementation(async(name:string,callback:()=>void)=>{state.listeners.set(name,callback);return {remove:vi.fn()};});
 document.documentElement.classList.remove('native-android','keyboard-visible');
});
it('leaves browser and desktop native chrome alone',async()=>{
 const {initializeNativeLayout}=await import('../../src/services/nativeLayout');await initializeNativeLayout();
 expect(document.documentElement.classList.contains('native-android')).toBe(false);
 expect(state.addListener).not.toHaveBeenCalled();
});
it('registers Android keyboard state once so navigation can stay clear of inputs',async()=>{
 state.platform='android';const {initializeNativeLayout}=await import('../../src/services/nativeLayout');
 await initializeNativeLayout();await initializeNativeLayout();
 expect(state.addListener).toHaveBeenCalledTimes(2);
 expect(document.documentElement.classList.contains('native-android')).toBe(true);
 state.listeners.get('keyboardWillShow')!();expect(document.documentElement.classList.contains('keyboard-visible')).toBe(true);
 state.listeners.get('keyboardWillHide')!();expect(document.documentElement.classList.contains('keyboard-visible')).toBe(false);
});
