#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ObjCExceptionCatcher : NSObject

+ (BOOL)executeBlock:(void (NS_NOESCAPE ^)(void))block
               error:(NSError * _Nullable __autoreleasing *)error;

@end

NS_ASSUME_NONNULL_END
