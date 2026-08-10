#import "AddictStopPlugin.h"
#import <UserNotifications/UserNotifications.h>

/*
 * Preference keys, mirroring LockState.java on the Android side.
 */
static NSString *const kLocked = @"addictstop.locked";
static NSString *const kPrayer = @"addictstop.prayer";
static NSString *const kRakahs = @"addictstop.rakahs";
static NSString *const kSince = @"addictstop.lockedSince";
static NSString *const kPending = @"addictstop.pendingTrigger";
static NSString *const kArmed = @"addictstop.armed";

/* iOS keeps at most 64 pending local notifications per app. */
static const NSUInteger kMaxScheduled = 60;
static NSString *const kRequestPrefix = @"addictstop.prayer.";

@interface AddictStopPlugin ()
@property (nonatomic, copy) NSString *eventCallbackId;
@end

@implementation AddictStopPlugin

#pragma mark - lifecycle

- (void)pluginInitialize {
    [super pluginInitialize];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(onAppForeground)
                                                 name:UIApplicationDidBecomeActiveNotification
                                               object:nil];
}

- (void)dispose {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [super dispose];
}

- (void)onAppForeground {
    [self sendEvent:@"resume" payload:@{}];
}

- (NSUserDefaults *)store {
    return [NSUserDefaults standardUserDefaults];
}

#pragma mark - status

- (NSDictionary *)statusDictionary {
    NSUserDefaults *store = [self store];
    BOOL notificationsAsked = [[UIApplication sharedApplication] isRegisteredForRemoteNotifications];
    return @{
        @"locked": @([store boolForKey:kLocked]),
        @"armed": @([store boolForKey:kArmed]),
        @"prayer": [store stringForKey:kPrayer] ?: [NSNull null],
        @"rakahs": @([store integerForKey:kRakahs]),
        @"lockedSince": @([store doubleForKey:kSince]),
        // Nothing on iOS lets one app keep another out of the foreground.
        @"canBlock": @NO,
        @"accessibility": @NO,
        @"overlay": @NO,
        @"exactAlarms": @YES,
        @"notifications": @(notificationsAsked),
        @"batteryUnrestricted": @YES,
        @"platform": @"ios"
    };
}

- (void)sendStatus:(CDVInvokedUrlCommand *)command {
    CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK
                                           messageAsDictionary:[self statusDictionary]];
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

- (void)getStatus:(CDVInvokedUrlCommand *)command {
    // Ask the notification centre for the live authorisation state rather than
    // trusting the registration flag, then answer.
    [[UNUserNotificationCenter currentNotificationCenter]
        getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
            NSMutableDictionary *status = [[self statusDictionary] mutableCopy];
            status[@"notifications"] = @(settings.authorizationStatus == UNAuthorizationStatusAuthorized ||
                                         settings.authorizationStatus == UNAuthorizationStatusProvisional);
            CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK
                                                   messageAsDictionary:status];
            [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
        }];
}

#pragma mark - arming and locking

- (void)setArmed:(CDVInvokedUrlCommand *)command {
    BOOL armed = [[command argumentAtIndex:0 withDefault:@NO] boolValue];
    [[self store] setBool:armed forKey:kArmed];

    if (!armed) {
        [self cancelAllScheduled];
        [self clearLock];
        [self sendStatus:command];
        return;
    }

    [[UNUserNotificationCenter currentNotificationCenter]
        requestAuthorizationWithOptions:(UNAuthorizationOptionAlert |
                                         UNAuthorizationOptionSound |
                                         UNAuthorizationOptionBadge)
                      completionHandler:^(BOOL granted, NSError *error) {
            [self.commandDelegate runInBackground:^{
                [self sendStatus:command];
            }];
        }];
}

- (void)lock:(CDVInvokedUrlCommand *)command {
    NSString *prayer = [command argumentAtIndex:0 withDefault:@"Prayer"];
    NSInteger rakahs = [[command argumentAtIndex:1 withDefault:@2] integerValue];

    NSUserDefaults *store = [self store];
    [store setBool:YES forKey:kLocked];
    [store setObject:prayer forKey:kPrayer];
    [store setInteger:rakahs forKey:kRakahs];
    [store setDouble:[[NSDate date] timeIntervalSince1970] * 1000.0 forKey:kSince];
    [self sendStatus:command];
}

- (void)unlock:(CDVInvokedUrlCommand *)command {
    [self clearLock];
    [self sendStatus:command];
}

- (void)clearLock {
    NSUserDefaults *store = [self store];
    [store setBool:NO forKey:kLocked];
    [store removeObjectForKey:kPrayer];
    [store removeObjectForKey:kRakahs];
    [store removeObjectForKey:kPending];
}

- (void)consumeTrigger:(CDVInvokedUrlCommand *)command {
    NSString *pending = [[self store] stringForKey:kPending];
    [[self store] removeObjectForKey:kPending];
    CDVPluginResult *result = [CDVPluginResult
        resultWithStatus:CDVCommandStatus_OK
     messageAsDictionary:@{@"prayer": pending ?: [NSNull null]}];
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

#pragma mark - scheduling

/**
 * One local notification per upcoming prayer, each carrying the bundled
 * recitation. They fire whether or not the app is running; what they cannot do
 * is run code, so the lock is raised by the JS when the app is next opened.
 */
- (void)schedule:(CDVInvokedUrlCommand *)command {
    NSArray *prayers = [command argumentAtIndex:0 withDefault:@[]];
    UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
    [self cancelAllScheduled];

    if (![[self store] boolForKey:kArmed]) {
        CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK
                                               messageAsDictionary:@{@"armed": @0}];
        [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
        return;
    }

    NSTimeInterval now = [[NSDate date] timeIntervalSince1970];
    NSUInteger scheduled = 0;

    for (NSDictionary *prayer in prayers) {
        if (scheduled >= kMaxScheduled) {
            break;
        }
        if (![prayer isKindOfClass:[NSDictionary class]]) {
            continue;
        }
        // `at` arrives as epoch milliseconds, matching the Android payload.
        NSTimeInterval at = [prayer[@"at"] doubleValue] / 1000.0;
        if (at <= now + 1.0) {
            continue;
        }
        NSString *name = prayer[@"name"] ?: @"Prayer";

        UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
        content.title = [NSString stringWithFormat:@"It is time for %@", name];
        content.body = [NSString stringWithFormat:@"Follow the stickman through %@ to tick it off.", name];
        content.sound = [UNNotificationSound soundNamed:@"adhan.caf"];
        content.userInfo = @{@"prayer": name, @"rakahs": prayer[@"rakahs"] ?: @2};
        if (@available(iOS 15.0, *)) {
            // Time sensitive so it can break through a Focus, the way a call to
            // prayer is meant to.
            content.interruptionLevel = UNNotificationInterruptionLevelTimeSensitive;
        }

        UNTimeIntervalNotificationTrigger *trigger =
            [UNTimeIntervalNotificationTrigger triggerWithTimeInterval:(at - now) repeats:NO];
        NSString *identifier = [NSString stringWithFormat:@"%@%lu", kRequestPrefix, (unsigned long)scheduled];
        UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:identifier
                                                                             content:content
                                                                             trigger:trigger];
        [center addNotificationRequest:request withCompletionHandler:nil];
        scheduled++;
    }

    CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK
                                           messageAsDictionary:@{@"armed": @(scheduled)}];
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

- (void)cancelAllScheduled {
    NSMutableArray<NSString *> *identifiers = [NSMutableArray array];
    for (NSUInteger i = 0; i < kMaxScheduled; i++) {
        [identifiers addObject:[NSString stringWithFormat:@"%@%lu", kRequestPrefix, (unsigned long)i]];
    }
    [[UNUserNotificationCenter currentNotificationCenter]
        removePendingNotificationRequestsWithIdentifiers:identifiers];
}

#pragma mark - events

- (void)watch:(CDVInvokedUrlCommand *)command {
    self.eventCallbackId = command.callbackId;
    CDVPluginResult *keep = [CDVPluginResult resultWithStatus:CDVCommandStatus_NO_RESULT];
    [keep setKeepCallbackAsBool:YES];
    [self.commandDelegate sendPluginResult:keep callbackId:command.callbackId];
}

- (void)sendEvent:(NSString *)type payload:(NSDictionary *)payload {
    if (self.eventCallbackId == nil) {
        return;
    }
    CDVPluginResult *result = [CDVPluginResult
        resultWithStatus:CDVCommandStatus_OK
     messageAsDictionary:@{@"type": type, @"payload": payload ?: @{}}];
    [result setKeepCallbackAsBool:YES];
    [self.commandDelegate sendPluginResult:result callbackId:self.eventCallbackId];
}

#pragma mark - settings screens

/**
 * iOS has exactly one destination available to an app: its own settings page.
 * Every permission the Android build opens a specific screen for maps here.
 */
- (void)openAppSettings:(CDVInvokedUrlCommand *)command {
    NSURL *url = [NSURL URLWithString:UIApplicationOpenSettingsURLString];
    dispatch_async(dispatch_get_main_queue(), ^{
        if (url != nil && [[UIApplication sharedApplication] canOpenURL:url]) {
            [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
        }
        CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
        [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
    });
}

- (void)openAccessibilitySettings:(CDVInvokedUrlCommand *)command { [self openAppSettings:command]; }
- (void)openOverlaySettings:(CDVInvokedUrlCommand *)command { [self openAppSettings:command]; }
- (void)openExactAlarmSettings:(CDVInvokedUrlCommand *)command { [self openAppSettings:command]; }
- (void)openBatterySettings:(CDVInvokedUrlCommand *)command { [self openAppSettings:command]; }
- (void)openNotificationSettings:(CDVInvokedUrlCommand *)command { [self openAppSettings:command]; }

@end
