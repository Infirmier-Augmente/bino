// Images importées (Metro les résout en source d'image, sur mobile comme sur le web).
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';

  const source: ImageSourcePropType;
  export default source;
}
