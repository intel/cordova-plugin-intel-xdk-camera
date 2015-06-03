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

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Windows.Phone.Media.Capture;
using System.Windows.Media;
using Microsoft.Xna.Framework.Media;
using Windows.Foundation;
using System.IO;
using Microsoft.Phone.Tasks;
using System.Diagnostics;
using System.Net;
using System.IO.IsolatedStorage;
using System.Windows.Media.Imaging;
using System.Reflection;
using Windows.Storage;
using WPCordovaClassLib.Cordova;
using WPCordovaClassLib.Cordova.Commands;
using WPCordovaClassLib.CordovaLib;
using Windows.ApplicationModel;

namespace Cordova.Extension.Commands
{
    public class IntelXDKCamera : BaseCommand
    {
        #region Private Variables
        private bool busy = false;

        private CameraCaptureTask cameraCaptureTask;
        private PhotoChooserTask photoChooserTask;

        private const string PICTURES = "_pictures";

        private PhotoCaptureDevice photoCaptureDevice { get; set; }
        #endregion

        #region Constructor
        /// <summary>
        /// Contructor
        /// </summary>
        public IntelXDKCamera()
        {
            cameraCaptureTask = new CameraCaptureTask();
            cameraCaptureTask.Completed += new EventHandler<PhotoResult>(cameraCaptureTask_Completed);
        }
        #endregion

        #region appMobi.js public methods
        public void getInfo(string parameters)
        {
            GetStartupInfo();
        }

        /// <summary>
        /// Takes the picture from camera task
        /// </summary>
        /// <param name="parameters"></param>
        public void takePicture(string parameters)
        {
            string[] args = WPCordovaClassLib.Cordova.JSON.JsonHelper.Deserialize<string[]>(parameters);

            string js = "";

            if (args.Length < 3)
            {
                js = (string.Format("javascript:var ev = document.createEvent('Events');" +
                        "ev.initEvent('intel.xdk.camera.picture.add',true,true);ev.success=false;" +
                        "ev.filename='{0}';ev.message='{1}';document.dispatchEvent(ev);", "", "Wrong number of parameters"));
                InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);
                return;
            }

            string quality = args[0];
            bool saveToLib = true;
            bool.TryParse(args[1], out saveToLib);
            string picType = args[2];

            if (busy)
            {
                cameraBusy();
                return;
            }
            this.busy = true;

            // Check to see if the camera is available on the device.
            if (PhotoCaptureDevice.AvailableSensorLocations.Contains(CameraSensorLocation.Back) || PhotoCaptureDevice.AvailableSensorLocations.Contains(CameraSensorLocation.Front))
            {
                DispatchCommandResult(new PluginResult(PluginResult.Status.OK, ""));
                cameraCaptureTask.Show();
            }
            else
            {
                // Write message.
                js = (string.Format("javascript:var ev = document.createEvent('Events');" +
                        "ev.initEvent('intel.xdk.camera.picture.add',true,true);" +
                        "ev.success=false;ev.message='{0}';document.dispatchEvent(ev);", "Camera is not available."));
                InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);
            }
        }

        /// <summary>
        /// Takes the picture from camera task
        /// </summary>
        /// <param name="parameters"></param>
        public void takeFrontPicture(string parameters)
        {
            string[] args = WPCordovaClassLib.Cordova.JSON.JsonHelper.Deserialize<string[]>(parameters);

            if (args.Length < 3)
            {
                string js = (string.Format("javascript:var ev = document.createEvent('Events');" +
                        "ev.initEvent('intel.xdk.camera.picture.add',true,true);ev.success=false;" +
                        "ev.filename='{0}';document.dispatchEvent(ev);", ""));
                InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);
                return;
            }

            string quality = args[0];
            bool saveToLib = true;
            bool.TryParse(args[1], out saveToLib);
            string picType = args[2];

            if (busy)
            {
                cameraBusy();
                return;
            }
            this.busy = true;

            // Check to see if the camera is available on the device.
            if (PhotoCaptureDevice.AvailableSensorLocations.Contains(CameraSensorLocation.Front))
            {
                cameraCaptureTask.Show();
            }
            else
            {
                // Write message.
                string js = (string.Format("javascript:var ev = document.createEvent('Events');" +
                        "ev.initEvent('intel.xdk.camera.picture.add',true,true);" +
                        "ev.success=false;ev.message='{0}';document.dispatchEvent(ev);", "Front camera is not available."));
                InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);
            }


        }

        /// <summary>
        /// Imports picture from Library to isolated storage photo folder
        /// </summary>
        /// <param name="parameters"></param>
        public void importPicture(string parameters)
        {
            if (busy)
            {
                cameraBusy();
                return;
            }
            this.busy = true;

            pickImage();
        }

        /// <summary>
        /// Deletes picture from isolated storage photo folder
        /// </summary>
        /// <param name="parameters"></param>
        public void deletePicture(string parameters)
        {
            string[] args = WPCordovaClassLib.Cordova.JSON.JsonHelper.Deserialize<string[]>(parameters);
            string url = HttpUtility.UrlDecode(args[0]);

            if (busy)
            {
                cameraBusy();
                return;
            }
            this.busy = true;
    
# if DEBUG
            Debug.WriteLine("AppMobiCamera.deletePicture: " + url);
#endif

            bool removed = RemovePhoto(url);

            string js = "";
            if (removed) {  /* Update the dictionary. */
                js = (string.Format("javascript:var ev = document.createEvent('Events');" +
                            "ev.initEvent('intel.xdk.camera.internal.picture.remove',true,true);ev.success=true;" +
                            "ev.filename='{0}';document.dispatchEvent(ev);" +
                            "ev = document.createEvent('Events');" +
                            "ev.initEvent('intel.xdk.camera.picture.remove',true,true);ev.success=true;" +
                            "ev.filename='{0}';document.dispatchEvent(ev);", url));
            } else {
                js = (string.Format("javascript:var ev = document.createEvent('Events');" +
                "ev.initEvent('intel.xdk.camera.picture.remove',true,true);ev.success=false;" +
                "ev.filename='{0}';document.dispatchEvent(ev);", url));
            }
            InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);

            this.busy = false;
        }

        /// <summary>
        /// Deletes all the pictures from isolated storage photo folder
        /// </summary>
        /// <param name="parameters"></param>
        public void clearPictures(string parameters)
        {
            string js = "";

            if (RemoveAllAppPhotos())
            {
                js = "javascript:var ev = document.createEvent('Events');" +
                                "ev.initEvent('intel.xdk.camera.internal.picture.clear',true,true);" +
                                "ev.success=true;document.dispatchEvent(ev);" +
                                "ev = document.createEvent('Events');" +
                                "ev.initEvent('intel.xdk.camera.picture.clear',true,true);" +
                                "ev.success=true;document.dispatchEvent(ev);";
            }
            else
            {
                js = (string.Format("javascript:var ev = document.createEvent('Events');" +
                                "ev.initEvent('intel.xdk.camera.picture.clear',true,true);" +
                                "ev.success=false;ev.message='{0}';document.dispatchEvent(ev);","Clearing images failed."));
            }

            InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);
        }

        public async Task GetStartupInfo()
        {
            string list = await GetPictureListJS();
            StorageFolder local = Windows.Storage.ApplicationData.Current.LocalFolder;

            string path = Path.Combine(local.Path, PICTURES).Replace(@"\",@"\\");

            //Info info = new Info() { pictureLocation = PICTURES };
            string info = "{\"pictureLocation\":\"" + path + "\", \"pictureList\":" + list + "}";
            DispatchCommandResult(new PluginResult(PluginResult.Status.OK, info));

            // Hack alert: needed to clean up the OnCustomScript object in BaseCommand.
            InvokeCustomScript(new ScriptCallback("eval", new string[] { "var temp = {};" }), true);
        }


        /// <summary>
        /// Gets All the pictures from the isolated storage photo folder
        /// </summary>
        /// <param name="parameters"></param>
        //public async Task GetPictures(string[] parameters)
        //{
        //    string list = await GetPictureListJS();

        //    string js = (string.Format("javascript:{0}; ev = document.createEvent('Events');" +
        //                    "ev.initEvent('intel.xdk.camera.picture.add',true,true);ev.success=true;" +
        //                    "document.dispatchEvent(ev);", list));
        //    InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);
        //}
        #endregion

        #region chooser handlers
        /// <summary>
        /// 
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private void cameraCaptureTask_Completed(object sender, PhotoResult e)
        {
            busy = false;

            switch (e.TaskResult)
            {
                case TaskResult.Cancel:
                    this.pictureCancelled();
                    break;

                case TaskResult.None:
                    break;

                case TaskResult.OK:
                    savePhoto(e);
                    break;

                default:
                    break;
            }
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private void photoChooserTask_Completed(object sender, PhotoResult e)
        {
            busy = false;

            switch (e.TaskResult)
            {
                case TaskResult.Cancel:
                    this.pictureCancelled();
                    break;
                case TaskResult.None:
                    break;
                case TaskResult.OK:
                    savePhoto(e);
                    break;

                default:
                    break;
            }
        }
        #endregion

        #region private methods
        public async Task<string> GetPictureListJS() {
            bool firstPic = true;

            try
            {
                StringBuilder js = new StringBuilder("[");

                StorageFolder storageFolder = await GetStorageFolder(PICTURES);

                foreach (StorageFile file in await storageFolder.GetFilesAsync())
                {
                    if (!firstPic)
                        js.Append(", ");
                    else
                        firstPic = false;

                    //js.Append(string.Format("'{0}'", PICTURES + "/" + file.Name));
                    js.Append(string.Format("\"{0}\"", file.Name));
                }

                js.Append("]");

                return js.ToString();
            }
            catch (Exception ex)
            {
                return "[]";
            }
        }

        /*
         * Show the photo gallery so the user can select a picture.
         */
        private void pickImage()
        {
            photoChooserTask = new PhotoChooserTask();
            photoChooserTask.Completed += new EventHandler<PhotoResult>(photoChooserTask_Completed);
            photoChooserTask.Show();
        }

        private void savePhoto(PhotoResult e)
        {
            String filePath = e.OriginalFileName;
            String fileName = Path.GetFileName(e.OriginalFileName);

            using (var isolatedStorage = IsolatedStorageFile.GetUserStoreForApplication())
            {
                BitmapImage bitmap = new BitmapImage();
                bitmap.SetSource(e.ChosenPhoto);

                //string folder = Package.Current.InstalledLocation.Path;

                string fullFilePath = Path.Combine( PICTURES, fileName);
                if (savePhotoToStorage(bitmap, fullFilePath))
                {
                    if (!filePath.Equals(string.Empty))
                    {
                        //var js = string.Format("javascript:var ev = document.createEvent('Events');" +
                        //            "ev.initEvent('intel.xdk.camera.internal.picture.add',true,true);ev.success=true;" +
                        //            "ev.filename='{0}';document.dispatchEvent(ev);" +
                        //            "ev = document.createEvent('Events');" +
                        //            "ev.initEvent('intel.xdk.camera.picture.add',true,true);ev.success=true;" +
                        //            "ev.filename='{0}';document.dispatchEvent(ev);", fileName);
                        //InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);

                        var js = "(function(name){var ev = document.createEvent('Events');" +
                            "ev.initEvent('intel.xdk.camera.internal.picture.add',true,true);ev.success=true;" +
                            "ev.filename=name;document.dispatchEvent(ev);" +
                            "ev = document.createEvent('Events');" +
                            "ev.initEvent('intel.xdk.camera.picture.add',true,true);ev.success=true;" +
                            "ev.filename=name;document.dispatchEvent(ev);})('" + fileName + "')";
                        InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);


                        //var js = string.Format("javascript:var ev = document.createEvent('Events');" +
                        //    "ev.initEvent('intel.xdk.camera.internal.picture.add',true,true);ev.success=true;" +
                        //    "ev.filename='{0}';document.dispatchEvent(ev);", fileName);
                        //InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), false);

                        //js = string.Format("javascript:var ev = document.createEvent('Events');" +
                        //    "ev.initEvent('intel.xdk.camera.picture.add',true,true);ev.success=true;" +
                        //    "ev.filename='{0}';document.dispatchEvent(ev);", fileName);
                        //InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);

                    }
                }
                else
                {
                    string js = (string.Format("javascript:intel.xdk.picturelist.push('{0}');var ev = document.createEvent('Events');" +
                                "ev.initEvent('intel.xdk.camera.picture.add',true,true);ev.success=false;" +
                                "ev.message='Photo capture failed';ev.filename='{0}';document.dispatchEvent(ev);", fileName));
                    InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);
                }
            }
        }

        //private void postAddError(String fileName)
        //{
        //    string js = (string.Format("javascript:var ev = document.createEvent('Events');" +
        //            "ev.initEvent('intel.xdk.camera.picture.add',true,true);" +
        //            "ev.success=false;ev.message='{0}';document.dispatchEvent(ev);", "Error taking photo."));
        //    InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);
        //}

        private void cameraBusy()
        {
            string js = ("javascript:var e = document.createEvent('Events');" +
                        "e.initEvent('intel.xdk.camera.picture.busy',true,true);" +
                        "e.success=false;e.message='busy';document.dispatchEvent(e);");
            InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);
        }

        private void pictureCancelled()
        {
            busy = false;
            string js = ("javascript:var ev = document.createEvent('Events');" +
                        "ev.initEvent('intel.xdk.camera.picture.cancel',true,true);" +
                        "ev.success=false;document.dispatchEvent(ev);");
            InvokeCustomScript(new ScriptCallback("eval", new string[] { js }), true);
        }

        private string getNextPictureFile(bool isPNG)
        {
            String baseName = null;
            int i = 0;

            //do
            //{
            baseName = String.Format("picture_%1$03d.%2$s", i++, isPNG ? "png" : "jpg");
            //} while (outFile.exists());
            return baseName;
        }

        /// <summary>
        /// Removes a specific photo for the isolated storage photo directory
        /// </summary>
        /// <param name="fileName"></param>
        /// <returns></returns>
        private bool RemovePhoto(string fileName)
        {
            try
            {
                using (var isolatedStorage = IsolatedStorageFile.GetUserStoreForApplication())
                {
                    if (isolatedStorage.FileExists(Path.Combine(PICTURES, fileName)))
                    {
                        isolatedStorage.DeleteFile(Path.Combine(PICTURES, fileName));
                    }
                }
            }
            catch (Exception)
            {
                //throw;
                return false;
            }

            return true;
        }


        /// <summary>
        /// Removes all the photos from the isolated storage photo directory
        /// </summary>
        /// <returns></returns>
        public bool RemoveAllAppPhotos()
        {
            try
            {
                using (var isolatedStorage = IsolatedStorageFile.GetUserStoreForApplication())
                {
                    if (isolatedStorage.DirectoryExists(PICTURES))
                    {
                        foreach (var file in isolatedStorage.GetFileNames(Path.Combine(PICTURES, "*.*")))
                        {
                            isolatedStorage.DeleteFile(Path.Combine(Path.Combine(PICTURES, file)));
                        }
                    }
                }
            }
            catch (Exception)
            {
                //throw;
                return false;
            }

            return true;
        }

        public static async Task<StorageFolder> GetStorageFolder(string path)
        {
            StorageFolder local = Windows.Storage.ApplicationData.Current.LocalFolder;

            //path = path.Replace(local.Path + "\\", "");
            StorageFolder storageFolder = await StorageFolder.GetFolderFromPathAsync(Path.Combine(local.Path,path));

            return storageFolder;
        }

        /// <summary>
        /// Saves the photo to the isolated storage photo directory
        /// </summary>
        /// <param name="bitmap"></param>
        /// <param name="fileName"></param>
        /// <returns></returns>
        public bool savePhotoToStorage(BitmapImage bitmap, string fileName)
        {
            try
            {
                using (var isolatedStorage = IsolatedStorageFile.GetUserStoreForApplication())
                {
                    string directoryPath = Path.GetDirectoryName(fileName);

                    if (!isolatedStorage.DirectoryExists(directoryPath))
                    {
                        Debug.WriteLine("INFO: Creating Directory : " + directoryPath);
                        isolatedStorage.CreateDirectory(directoryPath);
                    }

                    if (isolatedStorage.FileExists(fileName))
                        isolatedStorage.DeleteFile(fileName);

                    var fileStream = isolatedStorage.CreateFile(fileName);

                    var wb = new WriteableBitmap(bitmap);
                    wb.SaveJpeg(fileStream, wb.PixelWidth, wb.PixelHeight, 0, 100);
                    fileStream.Close();
                }

                return true;
            }
            catch (Exception ex)
            {
                //throw;
                return false;
            }
        }
        #endregion

    }

    //[Serializable()]
    //public class Info
    //{
    //    public string pictureLocation { get; set; }
    //    public string[] pictureList { get; set; }
    //}
}
