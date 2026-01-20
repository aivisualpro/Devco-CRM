import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.devcocrm.app',
  appName: 'DEVCOERP',
  webDir: 'mobile-build',
  server: {
    androidScheme: 'https',
    url: 'http://192.168.1.23:3000',
    //url: 'https://devco-alpha.vercel.app/',
    cleartext: true
  }
};

export default config;
