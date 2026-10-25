// Stand-in for '@react-three/fiber' when finding sound cues.
export const useFrame = () => {}
export const useThree = () => ({ camera: {}, scene: {}, gl: {}, size: { width: 1920, height: 1080 } })
export const Canvas = () => null
