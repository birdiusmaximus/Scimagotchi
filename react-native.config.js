// Keep Capacitor out of the NATIVE (EAS) build's autolinking.
//
// Each @capacitor/* package ships an iOS podspec / Android gradle module, so
// React Native autolinking would otherwise pull `Capacitor` + `CapacitorCordova`
// (and the plugin pods) into this app's native project. They don't belong there:
// the native build talks to React Native directly, and those Cordova-based pods
// can't integrate as static libraries — which breaks `pod install` on EAS.
//
// Capacitor is only the WebView wrap (see CAPACITOR*.md); its bridge no-ops
// off-web, so excluding the native modules changes nothing at runtime here.
module.exports = {
  dependencies: {
    '@capacitor/core': { platforms: { ios: null, android: null } },
    '@capacitor/ios': { platforms: { ios: null, android: null } },
    '@capacitor/android': { platforms: { ios: null, android: null } },
    '@capacitor/keyboard': { platforms: { ios: null, android: null } },
    '@capacitor/status-bar': { platforms: { ios: null, android: null } },
  },
};
