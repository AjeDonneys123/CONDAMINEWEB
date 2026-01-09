import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import os from 'os'

const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168') || iface.address.startsWith('172.20')) {
          return iface.address;
        }
      }
    }
  }
  return 'localhost';
};

const currentIp = getLocalIp();

export default defineConfig({
  plugins: [
    react(),
    basicSsl() 
  ],
  server: {
    host: '0.0.0.0', 
    port: 5173,
    https: true,
    // On désactive les options HMR complexes qui peuvent bloquer Safari mobile en local
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})