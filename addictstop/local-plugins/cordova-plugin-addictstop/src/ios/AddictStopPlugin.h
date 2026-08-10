#import <Cordova/CDVPlugin.h>

/**
 * iOS side of the AddictStop bridge.
 *
 * Same JS API as the Android plugin, minus the part iOS will not allow: there
 * is no way for a sandboxed app to stop you opening another app. `getStatus`
 * reports `canBlock: NO` and the UI says so plainly rather than pretending.
 *
 * What this does provide is the adhan itself -- one local notification per
 * prayer, carrying the bundled recitation -- and the lock state the prayer
 * screen runs on.
 */
@interface AddictStopPlugin : CDVPlugin

- (void)getStatus:(CDVInvokedUrlCommand *)command;
- (void)setArmed:(CDVInvokedUrlCommand *)command;
- (void)schedule:(CDVInvokedUrlCommand *)command;
- (void)lock:(CDVInvokedUrlCommand *)command;
- (void)unlock:(CDVInvokedUrlCommand *)command;
- (void)consumeTrigger:(CDVInvokedUrlCommand *)command;
- (void)watch:(CDVInvokedUrlCommand *)command;
- (void)openAccessibilitySettings:(CDVInvokedUrlCommand *)command;
- (void)openOverlaySettings:(CDVInvokedUrlCommand *)command;
- (void)openExactAlarmSettings:(CDVInvokedUrlCommand *)command;
- (void)openBatterySettings:(CDVInvokedUrlCommand *)command;
- (void)openNotificationSettings:(CDVInvokedUrlCommand *)command;

@end
