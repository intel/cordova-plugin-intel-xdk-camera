intel.xdk.camera
================

For capturing images with the camera and accessing those images.

Description
-----------

The camera object consists of several methods to control the capturing and
maintenance of picture files. The camera object contains a list of photos known
as the "picture list". The picture list is where new images are placed once they
are created.

There are several methods in the camera object that allow the application to
control the files in this list. The application may add to the picture list by
capturing a photo from the device's native camera using
[camera.takePicture](#takepicture), a picture may be added to the list by
referencing a file on the device using [camera.importPicture](#importpicture),
all the photos on the list may be listed in an array using
[camera.getPictureList](#getpicturelist), photos may be removed from the list
singly using [camera.deletePicture](#deletepicture), or the picture list may be
wiped clear using [camera.clearPictures](#clearpictures). Finally, files in the
picture list may be referenced for use in an application using the
[camera.getPictureURL](#getpictureurl) method.

### Methods

-   [clearPictures](#clearpictures) — This command will remove all photos from
    your application's picture list.
-   [deletePicture](#deletepicture) — Use this command to remove a photo from
    your application's picture list.
-   [getPictureList](#getpicturelist) — This command will return a list of all
    pictures stored in the application's picture list.
-   [getPictureURL](#getpictureurl) — This command will return the URL of the
    picture on the local webserver.
-   [importPicture](#importpicture) — This method will move a photo from your
    application's native camera file service (e.g. the camera roll) to the
    picture list.
-   [takePicture](#takepicture) — Use this command to take a picture with your
    device's camera.

### Events

-   [picture.add](#pictureadd) — Fired when a photo is added to the
    application's picture list
-   [picture.busy](#picturebusy) — Fired when accessing the native camera
    functionality is blocked by another process
-   [picture.cancel](#picturecancel) — Fired when the user chooses to cancel
    rather than taking or importing a picture
-   [picture.clear](#pictureclear) — Fired when the application's picture list
    has been cleared
-   [picture.remove](#pictureremove) — Fired when a photo is removed from
    application's picture list

Methods
-------

### clearPictures

This command will remove all photos from your application's picture list.

```javascript
intel.xdk.camera.clearPictures();
```

#### Available Platforms

-   Apple iOS
-   Google Android
-   Microsoft Windows 8 - BETA
-   Microsoft Windows Phone 8 - BETA

#### Events

-   **[intel.xdk.camera.picture.clear](#pictureclear):** This event is fired
    once the `clearPictures` method has completed. It will return a parameter
    indicating whether it was successful or not.

#### Example

```javascript
document.addEventListener("intel.xdk.camera.picture.clear",onClear);

alert(intel.xdk.camera.getPictureList().length + " items in the picture list");
intel.xdk.camera.clearPictures();

function onRemove(evt)
{
  var arrPictureList = intel.xdk.camera.getPictureList();
  for (var x=0;x < arrPictureList.length;x++)
  {
    // create image
    var newImage = document.createElement('img');
    newImage.src=intel.xdk.camera.getPictureURL(arrPictureList[x]);
    newImage.setAttribute("style","width:100px;height:100px;");
    newImage.id=document.getElementById("img_" + arrPictureList[x]);
    document.body.appendChild(newImage);
  }
  if(evt.success==true)
  {
    alert("The picture list has been cleared");
  }
}
```

### deletePicture

Use this command to remove a photo from your application's picture list.

```javascript
intel.xdk.camera.deletePicture(pictureFilename);
```

#### Available Platforms

-   Apple iOS
-   Google Android
-   Microsoft Windows 8 - BETA
-   Microsoft Windows Phone 8 - BETA

#### Parameters

-   **pictureFilename:** The filename of the image in the picture list. This
    filename can be obtained from
    [camera.getPictureList](#cameragetpicturelist)

#### Events

-   **[intel.xdk.camera.picture.remove](#pictureremove):** This event is fired
    once the deletePicture method has completed. It will return parameters
    indicating whether it was successful or not, as well as the filename of the
    photo referenced in the picture list.

#### Example

```javascript
document.addEventListener("intel.xdk.camera.picture.remove",onRemove);
if (arrPictureList.length > 1)
{
  intel.xdk.camera.deletePicture(arrPictureList[0]);
}
function onRemove(evt)
{
  var arrPictureList = intel.xdk.camera.getPictureList();
  for (var x=0;x < arrPictureList.length;x++)
  {
    // create image
    var newImage = document.createElement('img');
    newImage.src=intel.xdk.camera.getPictureURL(arrPictureList[x]);
    newImage.setAttribute("style","width:100px;height:100px;");
    newImage.id=document.getElementById("img_" + arrPictureList[x]);
    document.body.appendChild(newImage);
  }
  if(evt.success==true)
  {
    alert(evt.filename +
        " has been removed from the application's picture list");
  }
}
```

### getPictureList

This command will return a list of all pictures stored in the application's
picture list.

```javascript
pictureListArray=intel.xdk.camera.getPictureList();
```

#### Description

The pictures in the picture list will persist across sessions. Get an array
listing the filenames of all the photos using this method. Use the
[getPictureURL](#getpictureurl) method to then reference the URL for the files
in the picture list in your application.

#### Available Platforms

-   Apple iOS
-   Google Android
-   Microsoft Windows 8 - BETA
-   Microsoft Windows Phone 8 - BETA

#### Example

```javascript
var arrPictureList = intel.xdk.camera.getPictureList();
for (var x=0;x < arrPictureList.length;x++)
{
  // create image
  var newImage = document.createElement('img');
  newImage.src=intel.xdk.camera.getPictureURL(arrPictureList[x]);
  newImage.setAttribute("style","width:100px;height:100px;");
  newImage.id=document.getElementById("img_" + arrPictureList[x]);
  document.body.appendChild(newImage);
}
```

### getPictureURL

This command will return the URL of the picture on the local webserver.

```javascript
pictureURL=intel.xdk.camera.getPictureURL(pictureFilename);
```

#### Description

Pictures that are in the picture list may be referenced on the application's
local webserver. To get the URL of those pictures, pass the filename of those
pictures on the picture list to this method.

#### Available Platforms

-   Apple iOS
-   Google Android
-   Microsoft Windows 8 - BETA
-   Microsoft Windows Phone 8 - BETA

#### Parameters

-   **pictureFilename:** The name of the picture to get the URL for referenced
    from the array returned from getPictureList

#### Example

```javascript
var arrPictureList = intel.xdk.camera.getPictureList();
for (var x=0;x < arrPictureList.length;x++)
{
  // create image
  var newImage = document.createElement('img');
  newImage.src=intel.xdk.camera.getPictureURL(arrPictureList[x]);
  newImage.setAttribute("style","width:100px;height:100px;");
  newImage.id=document.getElementById("img_" + arrPictureList[x]);
  document.body.appendChild(newImage);
}
```

### importPicture

This method will move a photo from your application's native camera file service
(e.g. the camera roll) to the picture list.

```javascript
intel.xdk.camera.importPicture();
```

#### Available Platforms

-   Apple iOS
-   Google Android
-   Microsoft Windows 8 - BETA
-   Microsoft Windows Phone 8 - BETA

#### Events

-   **[intel.xdk.camera.picture.add](#pictureadd):** This event is fired once
    the importPicture method has completed. It will return parameters indicating
    whether the import was successful or not, as well as the filename of the
    newly imported photo.
-   **[intel.xdk.camera.picture.busy](#picturebusy):** This event is fired if
    the camera.importPicture method is called while another process is blocking
    access to the picture list.
-   **[intel.xdk.camera.picture.cancel](#picturecancel):** This event is fired
    if the user cancels the image import without selecting a file to import.

#### Example

```javascript
document.addEventListener("intel.xdk.camera.picture.add",onSuccess);
document.addEventListener("intel.xdk.camera.picture.busy",onSuccess);
document.addEventListener("intel.xdk.camera.picture.cancel",onSuccess);

function capturePhoto() {
  intel.xdk.camera.importPicture();
}

function onSuccess(evt) {

  if (evt.success == true)
  {
    // create image
    var image = document.createElement('img');
    image.src=intel.xdk.camera.getPictureURL(evt.filename);
    image.id=evt.filename;
    document.body.appendChild(image);
  }
  else
  {
    if (evt.message != undefined)
    {
        alert(evt.message);
    }
    else
    {
        alert("error capturing picture");
    }
  }
}
```

### takePicture

Use this command to take a picture with your device's camera.

```javascript
intel.xdk.camera.takePicture(quality, saveToLibrary, pictureType);
```

#### Description

When this command is called, the native camera application for the device will
open and allow the user to take a picture. Once the photo has been taken, the
camera application will return control to the application. At that point, any
events associated with this command will be fired.

#### Available Platforms

-   Apple iOS
-   Google Android
-   Microsoft Windows 8 - BETA
-   Microsoft Windows Phone 8 - BETA

#### Parameters

-   **quality:** The quality parameter reflects the percentage of image
    compression done to the image captured by the camera. This parameter must be
    a value between 1 and 100. The default value is 70.
-   **saveToLibrary:** This parameter controls whether the photo is saved
    directly to the device's image library or not. It should be a boolean value
    (i.e. true or false). The default value is true.
-   **pictureType:** The parameter controls the file type the photo can be saved
    as. The valid string values are "jpg" and "png" respectively. The default
    value is "jpg".

#### Events

-   **[intel.xdk.camera.picture.add](#pictureadd):** This event is fired once
    the takePicture method has completed. It will return parameters indicating
    whether it was successful or not, as well as the filename of the newly
    captured photo.
-   **[intel.xdk.camera.picture.busy](#picturebusy):** This event will be fired
    if the camera.takePicture method is called while another process is blocking
    access to the camera.
-   **[intel.xdk.camera.picture.cancel](#picturecancel):** This event will be
    fired if the native camera functionality is cancelled without taking a
    photo.

#### Example

```javascript
document.addEventListener("intel.xdk.camera.picture.add",onSuccess);
document.addEventListener("intel.xdk.camera.picture.busy",onSuccess);
document.addEventListener("intel.xdk.camera.picture.cancel",onSuccess);

function capturePhoto() {
  intel.xdk.camera.takePicture(50,false,"jpg");
}

function onSuccess(evt) {

  if (evt.success == true)
  {
    // create image
    var image = document.createElement('img');
    image.src=intel.xdk.camera.getPictureURL(evt.filename);
    image.id=evt.filename;
    document.body.appendChild(image);
  }
  else
  {
    if (evt.message != undefined)
    {
        alert(evt.message);
    }
    else
    {
        alert("error capturing picture");
    }
  }
}

```

Events
------

### picture.add

Fired when a photo is added to the application's picture list

#### Description

This event is fired in response to a [takePicture](#takepicture) or
[importPicture](#importpicture) method once a photo is available to the
application in the picture list. The event is returned with two parameters.

-   **success:**
    This parameter returns a true or a false depending on whether the photo was
    successfully captured or not.
-   **filename:**
    The filename of the image in the picture list.

Once an image has been added to the picture list, it can be referenced in an
application using [getPictureURL](#getpictureurl) and passing its filename. The
entire list of available images file names can be accessed using
[getPictureList](#getpicturelist).

### picture.busy

Fired when accessing the native camera functionality is blocked by another
process

### picture.cancel

Fired when the user chooses to cancel rather than taking or importing a picture

#### Description

Fired when the user chooses to cancel rather than taking or importing a picture.

The event is returned with one parameter.

-   **success:**
    This parameter is always false for the cancel event

### picture.clear

This event is fired when the application's picture list has been cleared.

### picture.remove

This event is fired when a photo is removed from application's picture list.

