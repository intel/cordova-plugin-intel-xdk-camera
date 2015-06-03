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


var commandProxy = require('cordova/windows8/commandProxy');

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

        if (false) {
            var captureInitSettings = null;
            captureInitSettings = new Windows.Media.Capture.MediaCaptureInitializationSettings();
            captureInitSettings.audioDeviceId = "";
            captureInitSettings.videoDeviceId = "";
            captureInitSettings.streamingCaptureMode = Windows.Media.Capture.StreamingCaptureMode.video;
            captureInitSettings.photoCaptureSource = Windows.Media.Capture.PhotoCaptureSource.photo;
            captureInitSettings.realTimeModeEnabled = true;
            if (deviceList.length > 0)
                captureInitSettings.videoDeviceId = me.deviceList[0].id;

            var oMediaCapture = null;
            oMediaCapture = new Windows.Media.Capture.MediaCapture();
            oMediaCapture.initializeAsync(captureInitSettings).then(function (result) {
                createProfile();
            }, errorHandler);
        } else {

            var cameraCaptureUI = new Windows.Media.Capture.CameraCaptureUI();

            cameraCaptureUI.photoSettings.allowCropping = true;
            //var allowCrop = !!params[7];
            //if (!allowCrop) {
            //    cameraCaptureUI.photoSettings.allowCropping = false;
            //}

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
                                        var ev = document.createEvent('Events');
                                        ev.initEvent('intel.xdk.camera.internal.picture.add', true, true);
                                        ev.success = true;
                                        ev.filename = storageFile.name;
                                        document.dispatchEvent(ev);

                                        ev = document.createEvent('Events');
                                        ev.initEvent('intel.xdk.camera.picture.add', true, true);
                                        ev.success = true;
                                        ev.filename = storageFile.name;
                                        document.dispatchEvent(ev);

                                        cameraCaptureUI = null;
                                        me.busy = false;
                                    }
                                }, function () {
                                    var ev = document.createEvent('Events');
                                    ev.initEvent('intel.xdk.camera.picture.add', true, true);
                                    ev.success = false;
                                    ev.message = 'Photo capture failed';
                                    ev.filename = storageFile.name;
                                    document.dispatchEvent(ev);

                                    cameraCaptureUI = null;
                                    me.busy = false;
                                }, function () {

                                });
                        });
                } else {
                    var ev = document.createEvent('Events');
                    ev.initEvent('intel.xdk.camera.picture.add', true, true);
                    ev.success = false;
                    ev.message = 'The user canceled.';
                    ev.filename = "";
                    document.dispatchEvent(ev);

                    cameraCaptureUI = null;
                    me.busy = false;
                }
            }, function () {
                errorCallback("Fail to capture a photo.");
            });

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
                                            var ev = document.createEvent('Events');
                                            ev.initEvent('intel.xdk.camera.internal.picture.add', true, true);
                                            ev.success = true;
                                            ev.filename = storageFile.name;
                                            document.dispatchEvent(ev);

                                            ev = document.createEvent('Events');
                                            ev.initEvent('intel.xdk.camera.picture.add', true, true);
                                            ev.success = true;
                                            ev.filename = storageFile.name;
                                            document.dispatchEvent(ev);
                                        }
                                    }, function () {
                                        var ev = document.createEvent('Events');
                                        ev.initEvent('intel.xdk.camera.picture.add', true, true);
                                        ev.success = false;
                                        ev.message = 'Photo capture failed';
                                        ev.filename = storageFile.name;
                                        document.dispatchEvent(ev);

                                    }, function () {

                                    });
                            });
                    } else {
                        var ev = document.createEvent('Events');
                        ev.initEvent('intel.xdk.camera.picture.add', true, true);
                        ev.success = false;
                        ev.message = 'The user canceled.';
                        ev.filename = "";
                        document.dispatchEvent(ev);

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

                            var ev = document.createEvent('Events');
                            ev.initEvent('intel.xdk.camera.internal.picture.remove', true, true);
                            ev.success = true;
                            ev.filename=picURL;
                            document.dispatchEvent(ev);

                            ev = document.createEvent('Events');
                            ev.initEvent('intel.xdk.camera.picture.remove', true, true);
                            ev.success = true;
                            ev.filename = picURL;
                            document.dispatchEvent(ev);
                        } else {
                            var ev = document.createEvent('Events');
                            ev.initEvent('intel.xdk.camera.picture.remove', true, true);
                            ev.success = false;
                            ev.filename = picURL;
                            document.dispatchEvent(ev);
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

                    var ev = document.createEvent('Events');
                    ev.initEvent('intel.xdk.camera.internal.picture.clear', true, true);
                    ev.success = true; document.dispatchEvent(ev);

                    ev = document.createEvent('Events');
                    ev.initEvent('intel.xdk.camera.picture.clear', true, true);
                    ev.success = true; document.dispatchEvent(ev);

                }
            );


        } catch (e) {
            var ev = document.createEvent('Events');
            ev.initEvent('intel.xdk.camera.picture.clear', true, true);
            ev.success = false; ev.message = 'Clearing images failed.'; document.dispatchEvent(ev);
        }
    },

    cameraBusy: function() {
        var e = document.createEvent('Events');
        e.initEvent('intel.xdk.camera.picture.busy', true, true);
        e.success=false;e.message='busy';document.dispatchEvent(e);
    },

    enumerateCameras: function() {
        var me = module.exports;

        Windows.Devices.Enumeration.DeviceInformation.findAllAsync(Windows.Devices.Enumeration.DeviceClass.videoCapture).done(function (devices) {
            for (var i = 0; i < devices.length; i++) {
                me.deviceList.push(devices[i]);
            }
        });
    }
};

commandProxy.add('IntelXDKCamera', module.exports);
