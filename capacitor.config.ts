import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.bloomwell.health',
  appName: 'BloomWell',
  webDir: 'out',
  backgroundColor: '#f7f4fb',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#f7f4fb',
      style: 'DARK',
    },
    Keyboard: {
      resize: KeyboardResize.Native,
    },
  },
};

export default config;
