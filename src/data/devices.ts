export interface DeviceConfig {
  id: string
  name: string
  brand: string
  platform: 'ios' | 'android'
  type: 'phone' | 'tablet'
  // App Store / Play Store canvas dimensions (pixels)
  width: number
  height: number
  // Display aspect ratio label
  aspectRatio: string
  // Frame image in Supabase Storage device-frames bucket
  frameImagePath: string
  // 3D perspective frame (optional)
  frameImagePath3D?: string
  // Scale factor for high-res rendering
  scaleFactor: number
}

export const DEVICES: DeviceConfig[] = [
  // ── iOS Phones ────────────────────────────────────────────────────
  {
    id: 'iphone-16-pro-max',
    name: 'iPhone 16 Pro Max',
    brand: 'Apple',
    platform: 'ios',
    type: 'phone',
    width: 1320,
    height: 2868,
    aspectRatio: '19.5:9',
    frameImagePath: 'iphone-16-pro-max.png',
    frameImagePath3D: 'iphone-16-pro-max-3d.png',
    scaleFactor: 3,
  },
  {
    id: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    brand: 'Apple',
    platform: 'ios',
    type: 'phone',
    width: 1206,
    height: 2622,
    aspectRatio: '19.5:9',
    frameImagePath: 'iphone-16-pro.png',
    frameImagePath3D: 'iphone-16-pro-3d.png',
    scaleFactor: 3,
  },
  {
    id: 'iphone-16',
    name: 'iPhone 16',
    brand: 'Apple',
    platform: 'ios',
    type: 'phone',
    width: 1179,
    height: 2556,
    aspectRatio: '19.5:9',
    frameImagePath: 'iphone-16.png',
    scaleFactor: 3,
  },
  {
    id: 'iphone-15-pro-max',
    name: 'iPhone 15 Pro Max',
    brand: 'Apple',
    platform: 'ios',
    type: 'phone',
    width: 1290,
    height: 2796,
    aspectRatio: '19.5:9',
    frameImagePath: 'iphone-15-pro-max.png',
    scaleFactor: 3,
  },
  {
    id: 'iphone-15',
    name: 'iPhone 15',
    brand: 'Apple',
    platform: 'ios',
    type: 'phone',
    width: 1179,
    height: 2556,
    aspectRatio: '19.5:9',
    frameImagePath: 'iphone-15.png',
    scaleFactor: 3,
  },
  // ── iOS Tablets ───────────────────────────────────────────────────
  {
    id: 'ipad-pro-m4-13',
    name: 'iPad Pro 13" (M4)',
    brand: 'Apple',
    platform: 'ios',
    type: 'tablet',
    width: 2064,
    height: 2752,
    aspectRatio: '4:3',
    frameImagePath: 'ipad-pro-m4-13.png',
    scaleFactor: 2,
  },
  {
    id: 'ipad-air-m2',
    name: 'iPad Air 11" (M2)',
    brand: 'Apple',
    platform: 'ios',
    type: 'tablet',
    width: 1640,
    height: 2360,
    aspectRatio: '4:3',
    frameImagePath: 'ipad-air-m2.png',
    scaleFactor: 2,
  },
  // ── Android Phones ────────────────────────────────────────────────
  {
    id: 'samsung-galaxy-s25-ultra',
    name: 'Samsung Galaxy S25 Ultra',
    brand: 'Samsung',
    platform: 'android',
    type: 'phone',
    width: 1440,
    height: 3088,
    aspectRatio: '19.4:9',
    frameImagePath: 'samsung-s25-ultra.png',
    scaleFactor: 3,
  },
  {
    id: 'samsung-galaxy-s25',
    name: 'Samsung Galaxy S25',
    brand: 'Samsung',
    platform: 'android',
    type: 'phone',
    width: 1080,
    height: 2340,
    aspectRatio: '19.5:9',
    frameImagePath: 'samsung-s25.png',
    scaleFactor: 3,
  },
  {
    id: 'google-pixel-9-pro',
    name: 'Google Pixel 9 Pro',
    brand: 'Google',
    platform: 'android',
    type: 'phone',
    width: 1080,
    height: 2424,
    aspectRatio: '20:9',
    frameImagePath: 'pixel-9-pro.png',
    scaleFactor: 3,
  },
  // ── Android Tablets ───────────────────────────────────────────────
  {
    id: 'android-tablet-generic',
    name: 'Android Tablet (10")',
    brand: 'Generic',
    platform: 'android',
    type: 'tablet',
    width: 1600,
    height: 2560,
    aspectRatio: '16:10',
    frameImagePath: 'android-tablet.png',
    scaleFactor: 2,
  },
]

export const DEVICE_MAP = Object.fromEntries(DEVICES.map(d => [d.id, d]))

export const getDevicesByPlatform = (platform: 'ios' | 'android') =>
  DEVICES.filter(d => d.platform === platform)

export const getPhones = () => DEVICES.filter(d => d.type === 'phone')
export const getTablets = () => DEVICES.filter(d => d.type === 'tablet')

// Canvas preview dimensions (scaled down for editor UI)
export const PREVIEW_WIDTH = 390
export const PREVIEW_HEIGHT = 844

export const DEFAULT_DEVICE = DEVICES[0] // iPhone 16 Pro Max
