/*
Copyright 2015 Intel Corporation

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file 
except in compliance with the License. You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the 
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, 
either express or implied. See the License for the specific language governing permissions 
and limitations under the License
*/

#import "XDKCamera.h"
#import <ImageIO/ImageIO.h>
#import <MobileCoreServices/MobileCoreServices.h>

// "if(1)" turns OFF XDKog logging.
// "if(0)" turns ON XDKog logging.
#define XDKLog if(1); else NSLog


typedef enum : NSUInteger {
    XDKTestModeOff,
    XDKTestModeIgnore,
    XDKTestModeSucceed,
    XDKTestModeFail,
    XDKTestModeCancel,
    XDKTestModeInvalid
} XDKTestMode;

@interface XDKCamera () < UINavigationControllerDelegate,
                          UIImagePickerControllerDelegate,
                          UIPopoverControllerDelegate >

//! Flag set when there is a pending import/takePicture operation.
@property (nonatomic)       BOOL                    busy;

//! The URL for the directory where pictures taken or imported with this plugin
//! are stored.
@property (nonatomic)       NSURL*                  picturesDirectoryURL;

//! After taking a picture with the camera, save it to the system camera roll?
@property (nonatomic)       BOOL                    pictureSaveToLibrary;

//! After importing or taking a picture, what file type to save it as in the plugin
//! photos directory? (@"jpg" or @"png")
@property (copy, nonatomic) NSString*               pictureType;

//! If the picture is to be saved as a JPEG, what quality level to use (1.0 - 100.0)?
@property (nonatomic)       float                   pictureQuality;

//! The popover controller for the image picker popover when importing a picture from a
//! system photo album on an iPad.
@property (nonatomic)       UIPopoverController*    popover;

//! The picture number to assign to the next picture added to the pictures directory.
@property (nonatomic)       NSUInteger              nextPictureNumber;

//! Is testing mode turned on?
@property (nonatomic)       BOOL                    testModeEnabled;

//! If testing mode is turned on, what is the required behavior?
@property (nonatomic)       XDKTestMode             testModeAction;

//! If testing mode is turned on, milliseconds to delay before taking test action.
@property (nonatomic)       NSUInteger              testModeDelay;

@end

@implementation XDKCamera

#pragma mark Private

//! Fire a JavaScript event.
//!
//! Generates a string of JavaScript code to create and dispatch an event.
//! @param eventName    The name of the event (not including the @c "intel.xdk." prefix).
//! @param success      The boolean value to assign to the @a success field in the
//!                     event object.
//! @param components   Each key/value pair in this dictionary will be incorporated.
//!                     (Note that the value must be a string which is the JavaScript
//!                     representation of the value - @c "true" for a boolean value,
//!                     @c "'Hello'" for a string, @c "20" for a number, etc.)
//!
//! @see fireEvent:success:components:internal:
//!
- (void) fireEvent:(NSString*)eventName
           success:(BOOL)success
        components:(NSDictionary*)components
{
    NSMutableString* eventComponents = [NSMutableString string];
    for (NSString *eachKey in components) {
        [eventComponents appendFormat:@"e.%@ = %@;", eachKey, components[eachKey]];
    }
    NSString* script = [NSString stringWithFormat:@"var e = document.createEvent('Events');"
                        "e.initEvent('intel.xdk.%@', true, true);"
                        "e.success = %@;"
                        "%@"
                        "document.dispatchEvent(e);",
                        eventName,
                        (success ? @"true" : @"false"),
                        eventComponents];
    XDKLog(@"%@", script);
    [self.commandDelegate evalJs:script];
}


//! Fire a JavaScript event and a related internal event.
//!
//! Use this method to fire an internal event before firing a client event. The internal
//! event is the same as the client event, with a modified name: Assuming that @a eventName
//! is @c "component.subcomponents.event", the internal event name is
//! @c "component.internal.subcomponents.event".
//!
//! Internal events are used to notify the plugin JavaScript to update its state before
//! sending the client event to a client code listener that may react by querying the
//! updated state.
//!
//! @note   It is only necessary to fire an internal event to inform the plugin Javascript that
//!         of some action that it needs to take. When no action is called for, the internal
//!         event should be suppressed. For example, a failure event (success = false) usually
//!         means that nothing actually happened, and that no plugin Javascript action is
//!         needed. This can conveniently be indicated by passing the same value to the
//!         @a success: and @a internal: parameters.
//!
//! @param eventName    The name of the client event (not including the @c "intel.xdk." prefix).
//! @param success      The boolean value to assign to the @a success field in the
//!                     event object.
//! @param components   Each key/value pair in this dictionary will be incorporated.
//!                     (Note that the value must be a string which is the JavaScript
//!                     representation of the value - @c "true" for a boolean value,
//!                     @c "'Hello'" for a string, @c "20" for a number, etc.)
//! @param internal     YES => fire both the internal event and the specified event.
//!                     NO => fire only the specified event.
//!
//! @see fireEvent:success:components:
//!
- (void) fireEvent:(NSString*)eventName
           success:(BOOL)success
        components:(NSDictionary*)components
          internal:(BOOL)internal
{
    if (internal) {
        NSArray* nameParts = [eventName componentsSeparatedByString:@"."];
        NSMutableArray* internalNameParts = [NSMutableArray arrayWithArray:nameParts];
        [internalNameParts insertObject:@"internal" atIndex:1];
        NSString* internalName = [internalNameParts componentsJoinedByString:@"."];
        [self fireEvent:internalName success:success components:components];
    }
    [self fireEvent:eventName success:success components:components];
}


//! Is there already an import or take picture operation in progress?
//! If so, fire a @c camera.picture.busy event; if not, then there is now.
//! @return YES if already in use, NO otherwise.
- (BOOL) inUse
{
    if (self.busy) {
        [self fireEvent:@"camera.picture.busy"
                success:NO
             components:@{@"message":@"'busy'"}];
        return YES;

    }
    else {
        self.busy = YES;
        return NO;
    }
}


//! Get a list of the picture files in the plugin pictures directory.
//! @return An array whose elements are NSStrings containing the file names of all the files
//!         in the plugin pictures directory. nil if an error occurs.
- (NSArray*) getPicturesList
{
    NSFileManager* fm = [NSFileManager defaultManager];
    NSArray* pictures = [fm contentsOfDirectoryAtURL:self.picturesDirectoryURL
                          includingPropertiesForKeys:nil
                                             options:0
                                               error:nil];
    
    // Strip the picture file URLs down to just the bare file names.
    return [pictures valueForKey:@"lastPathComponent"];
}


//! Common implementation of the takePicture, takeFrontPicture, and importPicture commands.
//!
//! The picture is always saved as a file in the plugin pictures directory, and may optionally
//! be saved in the system camera roll.
//! @param  camera          YES => take picture with the camera, NO => import picture
//!                         from a system photo album.
//! @param  front           YES => use the front camera, NO => use the rear/only camera.
//!                         (Only if @a camera is YES.)
//! @param  saveToLibrary   Save the picture to the system camera roll?
//! @param  type            Save the picture in the plugin pictures directory as what
//!                         file type? (@"jpg" or @"png")
//! @param  quality         Compression to use when saving as a JPEG file. (1 (worst
//!                         quality / most compression) - 100 (best quality / no compression)
- (void) getPictureWithCamera:(BOOL)camera
                        front:(BOOL)front
                saveToLibrary:(BOOL)saveToLibrary
                         type:(NSString*)type
                      quality:(NSInteger)quality
{
    if ([self inUse]) {
        return;
    }

    self.pictureQuality = (quality < 1 ? 1 : quality > 100 ? 100 : quality) / 100.0;
    self.pictureSaveToLibrary = saveToLibrary;
    self.pictureType = ([type caseInsensitiveCompare:@"png"] == NSOrderedSame) ? @"png" : @"jpg";
    
    // In test mode, schedule an image capture mock action unless the specified action is
    // "ignore".
    if (self.testModeEnabled) {
        if (self.testModeAction == XDKTestModeIgnore) {
            self.busy = NO;
        }
        else {
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW,
                                         NSEC_PER_USEC * 1000 * self.testModeDelay),
                           dispatch_get_main_queue(),
                           ^{ [self mockImageCaptureAction]; }
                           );
        }
        return;
    }
    
    UIImagePickerController* picker = [UIImagePickerController new];
    picker.delegate = self;

    if (camera) {
        // Make sure the device has a camera.
        if (! [UIImagePickerController
               isSourceTypeAvailable: UIImagePickerControllerSourceTypeCamera]) {
            [self fireEvent:@"camera.picture.add"
                    success:NO
                 components:@{@"message":@"'camera does not exist or is not available'"}];
            self.busy = NO;
            return;
        }
        picker.sourceType = UIImagePickerControllerSourceTypeCamera;
        
        if (front) {
            // Make sure the device has a front camera.
            if (![UIImagePickerController isCameraDeviceAvailable:camera]) {
                [self fireEvent:@"camera.picture.add"
                        success:NO
                     components:@{@"message":@"'front camera does not exist or is not available'"}];
                self.busy = NO;
                return;
            }
            picker.cameraDevice = UIImagePickerControllerCameraDeviceFront;
        }
    }
    
    else /* !camera => choose from photo library */ {
        // Make sure the device has an accessible photo library.
        if (! [UIImagePickerController
               isSourceTypeAvailable: UIImagePickerControllerSourceTypePhotoLibrary]) {
            [self fireEvent:@"camera.picture.add"
                    success:NO
                 components:@{@"message":@"'library not supported'"}];
            self.busy = NO;
            return;
        }
        picker.sourceType = UIImagePickerControllerSourceTypePhotoLibrary;
    }

    // A library picker is shown as a popover on iPad.
    if (!camera && [[UIDevice currentDevice] userInterfaceIdiom] == UIUserInterfaceIdiomPad) {
        self.popover = [[UIPopoverController alloc] initWithContentViewController:picker];
        self.popover.delegate = self;
        [self.popover presentPopoverFromRect:CGRectMake(0, 0, 320, 480)
                                 inView:self.viewController.view
               permittedArrowDirections:UIPopoverArrowDirectionAny
                               animated:YES];
        self.popover.passthroughViews = nil;
    }
    // All iPhone image pickers and all camera image pickers use a presented view controller.
    else {
        [self.viewController presentViewController:picker animated:YES completion:nil];
    }
}


//! Simulate the behavior of an image picker completion delegate.
- (void) mockImageCaptureAction
{
    switch (self.testModeAction) {
        case XDKTestModeSucceed: {
            // Create a fake image.
            UIGraphicsBeginImageContextWithOptions(CGSizeMake(150, 150), NO, 0);
            UIBezierPath* path = [UIBezierPath bezierPathWithOvalInRect:CGRectMake(0, 0, 150, 150)];
            [[UIColor blueColor] setFill];
            [path fill];
            UIImage* image = UIGraphicsGetImageFromCurrentImageContext();
            UIGraphicsEndImageContext();
            // Pretend it was captured.
            [self successfullyCapturedImage:image metadata:@{}];
            break;
        }
        case XDKTestModeCancel:
            [self imageCaptureCancelled];
            break;
        default:
            break;
    }
}


//! Complete the processing of a captured image.
//!
//! Normally invoked from the image picker controller delegate when the image is
//! captured (from the camera or from the camera roll), but may also be invoked
//! from a mock success function in testing mode.
//! @param image    The captured image.
//! @param metadata The metadata dictionary from the image picker info dictionary.
- (void)successfullyCapturedImage:(UIImage *)image
                         metadata:(NSDictionary*)metadata
{
    // Find an unused filename in the app photo directory.
    NSString* fileName;
    NSURL* fileURL;
    do {
        fileName = [NSString stringWithFormat:@"picture_%03lu.%@",
                    (unsigned long)self.nextPictureNumber++, self.pictureType];
        fileURL = [self.picturesDirectoryURL URLByAppendingPathComponent:fileName];
    } while ([[NSFileManager defaultManager] fileExistsAtPath:[fileURL path]]);
    
    // Save the picture in a file
    CFStringRef utType = [self.pictureType isEqualToString:@"jpg"] ? kUTTypeJPEG : kUTTypePNG;
    NSMutableDictionary* options = [NSMutableDictionary new];
    [options addEntriesFromDictionary:metadata];
    options[(__bridge NSString*)kCGImageDestinationLossyCompressionQuality] =
        [NSNumber numberWithFloat:self.pictureQuality];
    CGImageDestinationRef dest = CGImageDestinationCreateWithURL((CFURLRef)fileURL, utType, 1, nil);
    CGImageDestinationAddImage(dest, image.CGImage, (CFDictionaryRef)options);
    BOOL ok = CGImageDestinationFinalize(dest);
    CFRelease(dest);
    
    self.busy = NO;
    [self fireEvent:@"camera.picture.add"
            success:ok
         components:@{@"filename":[NSString stringWithFormat:@"'%@'", fileName]}
           internal:ok];
}


//! Complete the processing when image capture was cancelled.
//!
//! Normally invoked from the image picker controller delegate when the user cancels it,
//! but may also be invoked from a mock cancel function in testing mode.
- (void)imageCaptureCancelled
{
    self.busy = NO;
    [self fireEvent:@"camera.picture.cancel" success:NO components:nil];
}


//! @brief Delete the contents of a specified directory.
//! @note Actually deletes and recreates the photos directory, which is the quickest and
//! easiest way of deleting its contents.
//! @return YES if successful, NO if some error occurred.
- (BOOL) eraseDirectory:(NSURL*) directory
{
    NSFileManager* fm = [NSFileManager defaultManager];

    return ([fm removeItemAtURL:directory
                          error:nil] &&
        [fm createDirectoryAtURL:directory
     withIntermediateDirectories:NO
                      attributes:nil
                           error:nil]);
}


//! Delete a specified file in a specified directory.
//! @param  filePath    Either a complete absolute path or just the name of a file in the
//!                     specified directory.
//! @param  directory   The directory containing the file to be deleted.
//! @return The name of the deleted file if successful; otherwise nil.
//! @note   If a full path is provided, it @e must be a path to a file in the specified
//!         directory.
//!
- (NSString*) deleteFile:(NSString*)filePath fromDirectory:(NSURL*)directory
{
    NSString* fileName = [filePath lastPathComponent];
    NSString* fileDirectory = [filePath stringByDeletingLastPathComponent];
    if ([fileDirectory length] == 0 ||
        [fileDirectory isEqualToString:[directory path]])
    {
        filePath = [[directory path] stringByAppendingPathComponent:fileName];
    }
    else {
        // Path is not to a file in the pictures directory
        return nil;
    }
    
    NSFileManager* fm = [NSFileManager defaultManager];
    if ([fm fileExistsAtPath:filePath] &&
        [fm removeItemAtPath:filePath error:nil])
    {
        // Success
        return fileName;
    }
    else {
        // File does not  exist, or remove failed.
        return nil;
    }
}


#pragma mark - UIImagePickerControllerDelegate

- (void) imagePickerController:(UIImagePickerController *)picker
 didFinishPickingMediaWithInfo:(NSDictionary *)info
{
    // Use the edited image, if there is one, or the original image otherwise.
    UIImage* image = info[UIImagePickerControllerEditedImage];
    if (!image) {
        image = info[UIImagePickerControllerOriginalImage];
    }
    
    // Save to the system camera roll.
    if (self.pictureSaveToLibrary) {
        UIImageWriteToSavedPhotosAlbum(image, nil, nil , nil);
    }
    
    if (self.popover) {
        [self.popover dismissPopoverAnimated:YES];
        self.popover = nil;
    }
    else {
        [picker dismissViewControllerAnimated:YES completion:nil];
    }

    [self successfullyCapturedImage:image metadata:info[UIImagePickerControllerMediaMetadata]];
}


- (void) imagePickerControllerDidCancel:(UIImagePickerController *)picker
{
    [picker dismissViewControllerAnimated:YES completion:nil];
    [self imageCaptureCancelled];
}


#pragma mark - UIPopoverControllerDelegate

- (void) popoverControllerDidDismissPopover:(UIPopoverController *)popoverController
{
    self.popover = nil;
    [self imageCaptureCancelled];
}



#pragma mark - CDVPlugin

- (void)pluginInitialize
{
    [super pluginInitialize];
    self.busy = NO;
    
    // Find or create the plugin pictures directory, and set the picturesDirectoryURL
    // instance variable to point to it. If the directory does not exist and could
    // not be created, set the variable to nil.
    NSFileManager* fm = [NSFileManager defaultManager];
    NSURL* documents = [fm URLForDirectory:NSDocumentDirectory
                                  inDomain:NSUserDomainMask
                         appropriateForURL:nil
                                    create:YES
                                     error:nil];
    if (documents) {
        NSURL* picsDir = [documents URLByAppendingPathComponent:@"intel.xdk.camera"
                                                    isDirectory:YES];
        if ([fm fileExistsAtPath:[picsDir path]] ||
            [fm createDirectoryAtURL:picsDir
         withIntermediateDirectories:NO
                          attributes:nil
                               error:nil])
        {
            self.picturesDirectoryURL = picsDir;
        }
    }
    
    // Set the nextPictureNumber property to one higher than the largest number used in any
    // existing picture file name.
    NSError* err;
    NSRegularExpression* regex =
        [NSRegularExpression regularExpressionWithPattern:@"(?<=^picture_)\\d+"
                                                  options:0
                                                    error:&err];
    self.nextPictureNumber = 1;
    if (err) {
        NSLog(@"%@", err);
    }
    else {
        for (NSString* pic in [self getPicturesList]) {
            NSRange nr = [regex rangeOfFirstMatchInString:pic
                                                  options:0
                                                    range:NSMakeRange(0, [pic length])];
            if (nr.location != NSNotFound) {
                NSInteger filenum = [[pic substringWithRange:nr] integerValue];
                if (filenum >= self.nextPictureNumber) {
                    self.nextPictureNumber = filenum + 1;
                }
            }
        }
    }
}


#pragma mark - Commands

- (void)getInfo:(CDVInvokedUrlCommand*)command
{
    XDKLog(@"called getInfo");
    NSArray* pictures = [self getPicturesList];
    CDVPluginResult* result;
    if (self.picturesDirectoryURL && pictures) {
        result = [CDVPluginResult
                  resultWithStatus:CDVCommandStatus_OK
                  messageAsDictionary:@{@"pictureLocation":[self.picturesDirectoryURL path],
                                        @"pictureList":pictures}];
    }
    else if (!self.picturesDirectoryURL) {
        result = [CDVPluginResult
                  resultWithStatus:CDVCommandStatus_ERROR
                  messageAsString:@"Unable to create the plugin pictures directory"];
    }
    else {
        result = [CDVPluginResult
                  resultWithStatus:CDVCommandStatus_ERROR
                  messageAsString:@"Unable to retrieve the pictures list"];
    }
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}


- (void)takePicture:(CDVInvokedUrlCommand*)command
{
    XDKLog(@"called takePicture");
    [self getPictureWithCamera:YES
                         front:NO
                 saveToLibrary:[[command argumentAtIndex:1 withDefault:@YES] boolValue]
                          type:[command argumentAtIndex:2 withDefault:@"jpg" andClass:[NSString class]]
                       quality:[[command argumentAtIndex:0 withDefault:@70] integerValue]];
}


- (void)takeFrontPicture:(CDVInvokedUrlCommand*)command
{
    XDKLog(@"called takeFrontPicture");
    [self getPictureWithCamera:YES
                         front:YES
                 saveToLibrary:[[command argumentAtIndex:1 withDefault:@YES] boolValue]
                          type:[command argumentAtIndex:2 withDefault:@"jpg" andClass:[NSString class]]
                       quality:[[command argumentAtIndex:0 withDefault:@70] integerValue]];
}


- (void)importPicture:(CDVInvokedUrlCommand*)command
{
    XDKLog(@"called importPicture");
    [self getPictureWithCamera:NO
                         front:NO
                 saveToLibrary:NO
                          type:@"png"
                       quality:70];
}


- (void)deletePicture:(CDVInvokedUrlCommand*)command
{
    XDKLog(@"called deletePictures");
    if ([self inUse]) return;
    NSString* file = [command argumentAtIndex:0 withDefault:nil andClass:[NSString class]];
    NSString* removedFile = file ?
        [self deleteFile:file fromDirectory:self.picturesDirectoryURL] :
        nil;
    NSDictionary* dict = removedFile ?
        @{@"filename":[NSString stringWithFormat:@"'%@'", removedFile]} :
        nil;
    self.busy = NO;
    [self fireEvent:@"camera.picture.remove"
            success:(removedFile != nil)
         components:dict
           internal:(removedFile != nil)];
}


- (void)clearPictures:(CDVInvokedUrlCommand*)command
{
    XDKLog(@"called clearPictures");
    if ([self inUse]) return;
    BOOL ok = [self eraseDirectory:self.picturesDirectoryURL];
    self.busy = NO;
    [self fireEvent:@"camera.picture.clear"
            success:ok
         components:nil
           internal:ok];
}


- (void)setTestMode:(CDVInvokedUrlCommand*)command
{
    XDKLog(@"called setTestMode");
    NSString* modeString = [command argumentAtIndex:0 withDefault:@""];
    self.testModeAction = [modeString isEqualToString:@"off"]     ? XDKTestModeOff
                        : [modeString isEqualToString:@"succeed"] ? XDKTestModeSucceed
                        : [modeString isEqualToString:@"fail"]    ? XDKTestModeFail
                        : [modeString isEqualToString:@"cancel"]  ? XDKTestModeCancel
                        : [modeString isEqualToString:@"ignore"]  ? XDKTestModeIgnore
                        :                                           XDKTestModeInvalid
                        ;
    NSAssert(self.testModeAction != XDKTestModeInvalid,
             @"Invalid test mode argument \"%@\"to [IntelXDKCamera setTestMode",
             modeString);
    self.testModeEnabled = self.testModeAction != XDKTestModeOff;
    self.testModeDelay = [[command argumentAtIndex:1 withDefault:@0] integerValue];
}

@end
