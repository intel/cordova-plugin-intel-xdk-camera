
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


// This try/catch is temporary to maintain backwards compatibility. Will be removed and changed to just 
// require('cordova/exec/proxy') at unknown date/time.
var commandProxy;
try {
    commandProxy = require('cordova/windows8/commandProxy');
} catch (e) {
    commandProxy = require('cordova/exec/proxy');
}

module.exports = {
    busy: false,
    cameraCaptureTask: null,
    photoChooserTask: null,
    localStorageHelper: null,
    photoCaptureDevice: null,
    pictureName: "_pictures",
    pictureExtension: "ms-appdata:///local/",
    deviceList: new Array(),

    getInfo: function (successCallback, errorCallback, params) {
        var me = module.exports;

        // replace picture location to pull picture from local folder.
        if (!intel.xdk.camera.pictureLocation || intel.xdk.camera.pictureLocation.indexOf("ms-appdata") == -1) {
            intel.xdk.camera.pictureLocation = me.pictureExtension + me.pictureName;
        }

        me.enumerateCameras();

        var applicationData = Windows.Storage.ApplicationData.current;
        var localFolder = applicationData.localFolder;

        localFolder.createFolderAsync(intel.xdk.camera.pictureLocation.replace(me.pictureExtension, ""), Windows.Storage.CreationCollisionOption.openIfExists).then(
            function (dataFolder) {
                dataFolder.getFilesAsync().then(
                    function (files) {
                        var tempPictureList = [];

                        files.forEach(function (file) {
                            tempPictureList.push(file.name);
                        })

                        var info = {};
                        info.pictureLocation = me.pictureExtension + me.pictureName;
                        info.pictureList = tempPictureList;
                        successCallback(info);

                    },
                    function (error) {

                    }
                )
            }
        );
    },

    takePicture: function(successCallback, errorCallback, params) {
        var me = module.exports;

        var quality = params[0];
        var saveToLib = params[1];
        var picType = params[2];

        if (me.busy) {
            me.cameraBusy();
            return;
        }

        me.busy = true;

        if (Windows.Media.Capture.CameraCaptureUI) {
            var cameraCaptureUI = new Windows.Media.Capture.CameraCaptureUI();

            cameraCaptureUI.photoSettings.allowCropping = true;

            if (picType == "png") {
                cameraCaptureUI.photoSettings.format = Windows.Media.Capture.CameraCaptureUIPhotoFormat.png;
            } else {
                cameraCaptureUI.photoSettings.format = Windows.Media.Capture.CameraCaptureUIPhotoFormat.jpeg;
            }

            cameraCaptureUI.captureFileAsync(Windows.Media.Capture.CameraCaptureUIMode.photo).then(function (picture) {
                if (picture) {
                    var applicationData = Windows.Storage.ApplicationData.current;
                    var localFolder = applicationData.localFolder;

                    localFolder.createFolderAsync(intel.xdk.camera.pictureLocation.replace(me.pictureExtension, ""), Windows.Storage.CreationCollisionOption.openIfExists).then(
                        function (dataFolder) {
                            picture.copyAsync(dataFolder, picture.name, Windows.Storage.NameCollisionOption.replaceExisting).then(
                                function (storageFile) {
                                    if (storageFile != null) {
                                        /*var ev = document.createEvent('Events');
                                        ev.initEvent('intel.xdk.camera.internal.picture.add', true, true);
                                        ev.success = true;
                                        ev.filename = storageFile.name;
                                        document.dispatchEvent(ev);*/
                                        me.createAndDispatchEvent("intel.xdk.camera.internal.picture.add",
                                            {
                                                success: true,
                                                filename: storageFile.name
                                            });

                                        /*ev = document.createEvent('Events');
                                        ev.initEvent('intel.xdk.camera.picture.add', true, true);
                                        ev.success = true;
                                        ev.filename = storageFile.name;
                                        document.dispatchEvent(ev);*/
                                        me.createAndDispatchEvent("intel.xdk.camera.picture.add",
                                            {
                                                success: true,
                                                filename: storageFile.name
                                            });

                                        cameraCaptureUI = null;
                                        me.busy = false;
                                    }
                                }, function () {
                                    /*var ev = document.createEvent('Events');
                                    ev.initEvent('intel.xdk.camera.picture.add', true, true);
                                    ev.success = false;
                                    ev.message = 'Photo capture failed';
                                    ev.filename = storageFile.name;
                                    document.dispatchEvent(ev);*/
                                    me.createAndDispatchEvent("intel.xdk.camera.picture.add",
                                        {
                                            success: false,
                                            message: "Photo capture failed",
                                            filename: storageFile.name
                                        });

                                    cameraCaptureUI = null;
                                    me.busy = false;
                                }, function () {

                                });
                        });
                } else {
                    /*var ev = document.createEvent('Events');
                    ev.initEvent('intel.xdk.camera.picture.add', true, true);
                    ev.success = false;
                    ev.message = 'The user canceled.';
                    ev.filename = "";
                    document.dispatchEvent(ev);*/
                    me.createAndDispatchEvent("intel.xdk.camera.picture.add",
                        {
                            success: false,
                            message: "The user canceled",
                            filename: ""
                        });

                    cameraCaptureUI = null;
                    me.busy = false;
                }
            }, function () {
                errorCallback("Fail to capture a photo.");
            });
        } else {
            /* ********************************************************************************************
                THIS WAS TAKEN FROM APACHE CORDOVA'S CAMERA PROXY PLUGIN.
            ******************************************************************************************** */
            // We are running on WP8.1 which lacks CameraCaptureUI class
            // so we need to use MediaCapture class instead and implement custom UI for camera
            var saveToPhotoAlbum = params[1];
            var encodingType = params[2];

            var mediaType = params[3];
            var targetWidth = params[3];
            var targetHeight = params[3];
            var sourceType = params[3];
            var destinationType = params[3];
            var allowCrop = !!params[3];
            var cameraDirection = params[3];

            var CaptureNS = Windows.Media.Capture;

            var capturePreview = null,
                captureCancelButton = null,
                capture = null,
                captureSettings = null;

            var createCameraUI = function () {

                // Create fullscreen preview
                capturePreview = document.createElement("video");

                // z-order style element for capturePreview and captureCancelButton elts
                // is necessary to avoid overriding by another page elements, -1 sometimes is not enough
                capturePreview.style.cssText = "position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index:222999;";

                // Create cancel button
                captureCancelButton = document.createElement("button");
                captureCancelButton.innerText = "Cancel";
                captureCancelButton.style.cssText = "position: fixed; right: 0; bottom: 0; display: block; margin: 20px; z-index:2221000;";

                capture = new CaptureNS.MediaCapture();

                captureSettings = new CaptureNS.MediaCaptureInitializationSettings();
                captureSettings.streamingCaptureMode = CaptureNS.StreamingCaptureMode.video;
            };

            var startCameraPreview = function () {

                // Search for available camera devices
                // This is necessary to detect which camera (front or back) we should use
                var expectedPanel = cameraDirection === 1 ? Windows.Devices.Enumeration.Panel.front : Windows.Devices.Enumeration.Panel.back;
                Windows.Devices.Enumeration.DeviceInformation.findAllAsync(Windows.Devices.Enumeration.DeviceClass.videoCapture)
                .done(function (devices) {
                    if (devices.length > 0) {
                        devices.forEach(function (currDev) {
                            if (currDev.enclosureLocation.panel && currDev.enclosureLocation.panel == expectedPanel) {
                                captureSettings.videoDeviceId = currDev.id;
                            }
                        });

                        capture.initializeAsync(captureSettings).done(function () {
                            // This is necessary since WP8.1 MediaCapture outputs video stream rotated 90 degrees CCW
                            // TODO: This can be not consistent across devices, need additional testing on various devices
                            capture.setPreviewRotation(Windows.Media.Capture.VideoRotation.clockwise90Degrees);
                            // msdn.microsoft.com/en-us/library/windows/apps/hh452807.aspx
                            capturePreview.msZoom = true;
                            capturePreview.src = URL.createObjectURL(capture);
                            capturePreview.play();

                            // Insert preview frame and controls into page
                            document.body.appendChild(capturePreview);
                            document.body.appendChild(captureCancelButton);

                            // Bind events to controls
                            capturePreview.addEventListener('click', captureAction);
                            captureCancelButton.addEventListener('click', function () {
                                destroyCameraPreview();
                                errorCallback('Cancelled');
                            }, false);
                        }, function (err) {
                            destroyCameraPreview();
                            errorCallback('Camera intitialization error ' + err);
                        });
                    } else {
                        destroyCameraPreview();
                        errorCallback('Camera not found');
                    }
                });
            };

            var destroyCameraPreview = function () {
                capturePreview.pause();
                capturePreview.src = null;
                [capturePreview, captureCancelButton].forEach(function (elem) {
                    if (elem /* && elem in document.body.childNodes */) {
                        document.body.removeChild(elem);
                    }
                });
                if (capture) {
                    capture.stopRecordAsync();
                    capture = null;
                }
            };

            var captureAction = function () {

                var encodingProperties,
                    fileName,
                    generateUniqueCollisionOption = Windows.Storage.CreationCollisionOption.generateUniqueName,
                    tempFolder = Windows.Storage.ApplicationData.current.temporaryFolder;
                var applicationData = Windows.Storage.ApplicationData.current;
                var localFolder = applicationData.localFolder;

                localFolder.createFolderAsync(intel.xdk.camera.pictureLocation.replace(me.pictureExtension, ""), Windows.Storage.CreationCollisionOption.openIfExists).then(
                    function (dataFolder) {

                        if (encodingType == "png") {
                            fileName = 'photo.png';
                            encodingProperties = Windows.Media.MediaProperties.ImageEncodingProperties.createPng();
                        } else {
                            fileName = 'photo.jpg';
                            encodingProperties = Windows.Media.MediaProperties.ImageEncodingProperties.createJpeg();
                        }

                        dataFolder.createFileAsync(fileName, generateUniqueCollisionOption).done(function (capturedFile) {
                            capture.capturePhotoToStorageFileAsync(encodingProperties, capturedFile).done(function () {

                                destroyCameraPreview();

                                // success callback for capture operation
                                var success = function (capturedfile) {
                                    capturedfile.copyAsync(Windows.Storage.ApplicationData.current.localFolder, capturedfile.name, generateUniqueCollisionOption).done(function (copiedfile) {
                                        successCallback("ms-appdata:///local/" + copiedfile.name);

                                        me.busy = false;
                                        me.createAndDispatchEvent("intel.xdk.camera.internal.picture.add",
                                            {
                                                success: true,
                                                filename: copiedfile.name
                                            });
                                        me.createAndDispatchEvent("intel.xdk.camera.picture.add",
                                        {
                                            success: true,
                                            message: "Photo capture failed",
                                            filename: copiedfile.name
                                        });

                                    }, function () {
                                        errorCallback();

                                        me.busy = false;
                                        me.createAndDispatchEvent("intel.xdk.camera.picture.add",
                                            {
                                                success: false,
                                                message: "Photo capture failed",
                                                filename: ""
                                            });
                                    });
                                };

                                if (saveToPhotoAlbum) {
                                    capturedFile.copyAsync(Windows.Storage.KnownFolders.picturesLibrary, capturedFile.name, generateUniqueCollisionOption)
                                    .done(function () {
                                        success(capturedFile);
                                    }, function () {
                                        errorCallback();

                                        me.busy = false;
                                        me.createAndDispatchEvent("intel.xdk.camera.picture.add",
                                            {
                                                success: false,
                                                message: "Photo capture failed",
                                                filename: ""
                                            });
                                    });
                                } else {
                                    success(capturedFile);
                                }


                            }, function (err) {
                                destroyCameraPreview();
                                errorCallback(err);
                                me.busy = false;
                                me.createAndDispatchEvent("intel.xdk.camera.picture.add",
                                    {
                                        success: false,
                                        message: "Photo capture failed",
                                        filename: ""
                                    });
                            });
                        }, function (err) {
                            destroyCameraPreview();
                            errorCallback(err);
                            me.busy = false;
                            me.createAndDispatchEvent("intel.xdk.camera.picture.add",
                                {
                                    success: false,
                                    message: "Photo capture failed",
                                    filename: ""
                                });
                        });
                    });
            };

            try {
                createCameraUI();
                startCameraPreview();
            } catch (ex) {
                errorCallback(ex);
            }
            /* ********************************************************************************************
                THIS WAS TAKEN FROM APACHE CORDOVA'S CAMERA PROXY PLUGIN.
            ******************************************************************************************** */
        }
    },

    takeFrontPicture: function (successCallback, errorCallback, params) {
        var me = module.exports;
        me.takePicture(successCallback, errorCallback, params);
    },

    importPicture: function() {
        var me = module.exports;

        // replace picture location to pull picture from local folder.
        if (intel.xdk.camera.pictureLocation.indexOf("ms-appdata") == -1) {
            intel.xdk.camera.pictureLocation = pictureExtension + intel.xdk.camera.pictureLocation;
        }

        if (me.busy) {
            me.cameraBusy();
            return;
        }

        // Verify that we are currently not snapped, or that we can unsnap to open the picker
        var currentState = Windows.UI.ViewManagement.ApplicationView.value;

        if (currentState === Windows.UI.ViewManagement.ApplicationViewState.snapped &&
            !Windows.UI.ViewManagement.ApplicationView.tryUnsnap()) {
            // Fail silently if we can't unsnap
            return;
        }

        var openPicker = new Windows.Storage.Pickers.FileOpenPicker();
        openPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.picturesLibrary;
        openPicker.viewMode = Windows.Storage.Pickers.PickerViewMode.thumbnail;

        openPicker.fileTypeFilter.clear();
        openPicker.fileTypeFilter.append(".bmp");
        openPicker.fileTypeFilter.append(".png");
        openPicker.fileTypeFilter.append(".jpeg");
        openPicker.fileTypeFilter.append(".jpg");

        openPicker.pickSingleFileAsync().done(
                function (picture) {
                    if (picture) {
                        var applicationData = Windows.Storage.ApplicationData.current;
                        var localFolder = applicationData.localFolder;

                        localFolder.createFolderAsync(intel.xdk.camera.pictureLocation.replace(me.pictureExtension, ""), Windows.Storage.CreationCollisionOption.openIfExists).then(
                            function (dataFolder) {
                                picture.copyAsync(dataFolder, picture.name, Windows.Storage.NameCollisionOption.replaceExisting).then(
                                    function (storageFile) {
                                        if (storageFile != null) {
                                            /*var ev = document.createEvent('Events');
                                            ev.initEvent('intel.xdk.camera.internal.picture.add', true, true);
                                            ev.success = true;
                                            ev.filename = storageFile.name;
                                            document.dispatchEvent(ev);*/
                                            me.createAndDispatchEvent("intel.xdk.camera.internal.picture.add",
                                                {
                                                    success: true,
                                                    filename: storageFile.name
                                                });

                                            /*ev = document.createEvent('Events');
                                            ev.initEvent('intel.xdk.camera.picture.add', true, true);
                                            ev.success = true;
                                            ev.filename = storageFile.name;
                                            document.dispatchEvent(ev);*/
                                            me.createAndDispatchEvent("intel.xdk.camera.picture.add",
                                                {
                                                    success: true,
                                                    filename: storageFile.name
                                                });
                                        }
                                    }, function () {
                                        /*var ev = document.createEvent('Events');
                                        ev.initEvent('intel.xdk.camera.picture.add', true, true);
                                        ev.success = false;
                                        ev.message = 'Photo capture failed';
                                        ev.filename = storageFile.name;
                                        document.dispatchEvent(ev);*/
                                        me.createAndDispatchEvent("intel.xdk.camera.picture.add",
                                            {
                                                success: false,
                                                message: "Photo capture failed",
                                                filename: storageFile.name
                                            });

                                    }, function () {

                                    });
                            });
                    } else {
                        /*var ev = document.createEvent('Events');
                        ev.initEvent('intel.xdk.camera.picture.add', true, true);
                        ev.success = false;
                        ev.message = 'The user canceled.';
                        ev.filename = "";
                        document.dispatchEvent(ev);*/
                        me.createAndDispatchEvent("intel.xdk.camera.picture.add",
                            {
                                success: false,
                                message: "The user canceled",
                                filename: ""
                            });

                        openPicker = null;
                        me.busy = false;
                    }
                },
                function (error) {
                });
    },

    deletePicture: function (successCallback, errorCallback, params) {
        var me = module.exports;

        var picURL = params[0];

        var applicationData = Windows.Storage.ApplicationData.current;
        var localFolder = applicationData.localFolder;

        localFolder.createFolderAsync(intel.xdk.camera.pictureLocation.replace(me.pictureExtension, ""), Windows.Storage.CreationCollisionOption.openIfExists).then(
            function (dataFolder) {
                dataFolder.getFileAsync(picURL).then(
                    function (file) {
                        if (file) {
                            file.deleteAsync();

                            /*var ev = document.createEvent('Events');
                            ev.initEvent('intel.xdk.camera.internal.picture.remove', true, true);
                            ev.success = true;
                            ev.filename=picURL;
                            document.dispatchEvent(ev);*/
                            me.createAndDispatchEvent("intel.xdk.camera.internal.picture.remove",
                                {
                                    success: true,
                                    filename: picURL
                                });

                            /*ev = document.createEvent('Events');
                            ev.initEvent('intel.xdk.camera.picture.remove', true, true);
                            ev.success = true;
                            ev.filename = picURL;
                            document.dispatchEvent(ev);*/
                            me.createAndDispatchEvent("intel.xdk.camera.picture.remove",
                                {
                                    success: true,
                                    filename: picURL
                                });
                        } else {
                            /*var ev = document.createEvent('Events');
                            ev.initEvent('intel.xdk.camera.picture.remove', true, true);
                            ev.success = false;
                            ev.filename = picURL;
                            document.dispatchEvent(ev);*/
                            me.createAndDispatchEvent("intel.xdk.camera.picture.remove",
                                {
                                    success: false,
                                    filename: picURL
                                });
                        }
                    },
                    function (error) {

                    }
                )
            }
        );
    },

    clearPictures: function () {
        var me = module.exports;

        var applicationData = Windows.Storage.ApplicationData.current;
        var localFolder = applicationData.localFolder;

        try {
            localFolder.createFolderAsync(intel.xdk.camera.pictureLocation.replace(me.pictureExtension, ""), Windows.Storage.CreationCollisionOption.openIfExists).then(
                function (dataFolder) {
                    var list = new WinJS.Binding.List(me.pictureList);
                    list.forEach(function (value, index, array) {
                        dataFolder.getFileAsync(value).then(
                            function (file) {
                                if (file) {
                                    file.deleteAsync();
                                } else {
                                }
                            },
                            function (error) {

                            }
                        )
                    });

                    /*var ev = document.createEvent('Events');
                    ev.initEvent('intel.xdk.camera.internal.picture.clear', true, true);
                    ev.success = true; document.dispatchEvent(ev);*/
                    me.createAndDispatchEvent("intel.xdk.camera.internal.picture.clear",
                        {
                            success: true
                        });

                    /*ev = document.createEvent('Events');
                    ev.initEvent('intel.xdk.camera.picture.clear', true, true);
                    ev.success = true; document.dispatchEvent(ev);*/
                    me.createAndDispatchEvent("intel.xdk.camera.picture.clear",
                        {
                            success: true
                        });

                }
            );


        } catch (e) {
            /*var ev = document.createEvent('Events');
            ev.initEvent('intel.xdk.camera.picture.clear', true, true);
            ev.success = false; ev.message = 'Clearing images failed.'; document.dispatchEvent(ev);*/
            me.createAndDispatchEvent("intel.xdk.camera.picture.clear",
                {
                    success: false,
                    message: "Clearing images failed"
                });
        }
    },

    cameraBusy: function() {
        var me = module.exports;

        /*var e = document.createEvent('Events');
        e.initEvent('intel.xdk.camera.picture.busy', true, true);
        e.success=false;e.message='busy';document.dispatchEvent(e);*/
        me.createAndDispatchEvent("intel.xdk.camera.picture.busy",
            {
                success: false,
                message: "busy"
            });
    },

    enumerateCameras: function() {
        var me = module.exports;

        Windows.Devices.Enumeration.DeviceInformation.findAllAsync(Windows.Devices.Enumeration.DeviceClass.videoCapture).done(function (devices) {
            for (var i = 0; i < devices.length; i++) {
                me.deviceList.push(devices[i]);
            }
        });
    },

    createAndDispatchEvent: function (name, properties) {
        var e = document.createEvent('Events');
        e.initEvent(name, true, true);
        if (typeof properties === 'object') {
            for (key in properties) {
                e[key] = properties[key];
            }
        }
        document.dispatchEvent(e);
    },
};

commandProxy.add('IntelXDKCamera', module.exports);
