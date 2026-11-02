import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "de.cocomunich.zeit",
  appName: "COCO Zeit",
  webDir: "dist",
  backgroundColor: "#e9bc52",
  ios: {
    contentInset: "never",
    backgroundColor: "#e9bc52",
    scrollEnabled: true,
  },
};

export default config;
