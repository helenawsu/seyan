// TypeScript declaration for importing JSON modules
// Allows: import colors from './color-names.json';
declare module '*.json' {
  const value: any;
  export default value;
}
