#import "ObjCExceptionCatcher.h"

@implementation ObjCExceptionCatcher

+ (BOOL)executeBlock:(void (NS_NOESCAPE ^)(void))block
               error:(NSError * _Nullable __autoreleasing *)error {
    @try {
        block();
        return YES;
    } @catch (NSException *exception) {
        if (error) {
            *error = [NSError errorWithDomain:@"com.lockedin.screentime"
                                         code:-1
                                     userInfo:@{
                NSLocalizedDescriptionKey: exception.reason ?: @"Unknown ObjC exception",
                @"ExceptionName": exception.name ?: @"Unknown"
            }];
        }
        return NO;
    }
}

@end
