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

#import <UIKit/UIKit.h>
#import "Cordova/CDV.h"

@interface XDKCamera : CDVPlugin

- (void)getInfo:(CDVInvokedUrlCommand*)command;
- (void)takePicture:(CDVInvokedUrlCommand*)command;         // (quality, saveToLib, picType)
- (void)takeFrontPicture:(CDVInvokedUrlCommand*)command;    // (quality, saveToLib, picType)
- (void)importPicture:(CDVInvokedUrlCommand*)command;
- (void)deletePicture:(CDVInvokedUrlCommand*)command;       // (picURL)
- (void)clearPictures:(CDVInvokedUrlCommand*)command;

@end
