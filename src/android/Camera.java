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

package com.intel.xdk.camera;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Debug;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.util.Log;
import android.webkit.JavascriptInterface;

@SuppressWarnings("deprecation")
public class Camera extends CordovaPlugin{
	private static boolean debug = Debug.isDebuggerConnected();
	private static final String staticCameraPrefsKey = "APPMOBI_CAMERA_PREFS";
	private static final String cameraPrefsFileName = "APPMOBI_CAMERA_PREFS_FILENAME";
	private static final String cameraPrefsQuality = "APPMOBI_CAMERA_PREFS_QUALITY";
	private static final String cameraPrefsIsPNG = "APPMOBI_CAMERA_PREFS_IS_PNG";
	
	private static final int PICTURE_RESULT = 5;
	private static final int SELECT_PICTURE = 4;
	private static final int CAPTURE_IMAGE_ACTIVITY_REQUEST_CODE = 100;
	
	private int currentPhoto = 0;
	
	private boolean busy = false;
	//private File outputFile;
	//private boolean isPNG;
	//private int quality;	
	private String cameraPrefsKey;

	private CallbackContext callbackContext;
	
	private Activity activity;

	public Camera(){
	}

	@Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        
        //get convenience reference to activity
        activity = cordova.getActivity();
	}

/**
     * Executes the request and returns PluginResult.
     *
     * @param action            The action to execute.
     * @param args              JSONArray of arguments for the plugin.
     * @param callbackContext   The callback context used when calling back into JavaScript.
     * @return                  True when the action was valid, false otherwise.
     */
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if (action.equals("clearPictures")) {
            this.clearPictures();
        }
        else if (action.equals("deletePicture")) {
            this.deletePicture(args.getString(0));
        }
        else if (action.equals("getInfo")) {
    		//get pictureLocation and pictureList
            JSONObject r = new JSONObject();
            r.put("pictureLocation", pictureDir());
            List<String> pictureList = getPictureList();
            r.put("pictureList", new JSONArray(pictureList));
            callbackContext.success(r);
        }
        else if (action.equals("importPicture")) {
            this.importPicture();
            this.callbackContext = callbackContext;
        }
        else if (action.equals("takePicture")) {
            this.takePicture(args.getInt(0), args.getString(1), args.getString(2));
            this.callbackContext = callbackContext;
        }
        else {
            return false;
        }

        // All actions are async.
        //callbackContext.success();
        return true;
    }

	public List<String> getPictureList() {
    	File dir = new File(pictureDir());
		String[] pics = dir.list();
		
		return pics!=null?Arrays.asList(pics):new ArrayList<String>();
    }

	public synchronized String pictureDir() {
		//return activity.appDir().toString() + "/_pictures";

		return activity.getApplicationContext().getFilesDir() + "/_pictures";
	}
	
	private String getNextPictureFile(boolean isPNG) {
		String dir = pictureDir();
		File dirFile = new File(dir);
		if (!dirFile.exists())
			dirFile.mkdirs();
		String filePath = null, baseName = null;
		File outFile;
		int i = currentPhoto;
		do {			
			baseName = String.format("picture_%1$03d.%2$s", i++, isPNG?"png":"jpg");
			filePath = String.format("%1$s/%2$s", dir, baseName);
			outFile = new File(filePath);
		} while (outFile.exists());
		currentPhoto++;
		return baseName;
	}
	
	public synchronized void takePicture(final int quality, final String saveToLibYN, final String picType) {
		//saveToLibYN is not used because the camera activity always saves to gallery
		
		PackageManager pm = activity.getPackageManager();
		if (pm.hasSystemFeature(PackageManager.FEATURE_CAMERA) == false) {
	        fireJSEvent(
	        		"camera.picture.add", 
	        		false, 
	        		null, 
	        		new String[]{String.format("ev.error='device has no camera';")}
	        );
		}		


        if (busy) {
			cameraBusy();
		}
		this.busy = true;

		File outputFile = new File(Environment.getExternalStorageDirectory(),"test."+picType);
		
		//put required info in shared prefs
		SharedPreferences.Editor prefsEditor = activity.getSharedPreferences(cameraPrefsKey, 0).edit();
		prefsEditor.putString(cameraPrefsFileName, outputFile.getAbsolutePath());
		prefsEditor.putBoolean(cameraPrefsIsPNG, "png".equalsIgnoreCase(picType));
		prefsEditor.putInt(cameraPrefsQuality, quality);
		prefsEditor.commit();
		
		Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
		intent.putExtra(MediaStore.EXTRA_OUTPUT, Uri.fromFile(outputFile));
		
		//cordova.setActivityResultCallback(this);
		// TODO: figure this out
        cordova.startActivityForResult(this, intent, CAPTURE_IMAGE_ACTIVITY_REQUEST_CODE);
 		//activity.setLaunchedChildActivity(true);
        //activity.startActivityForResult(intent, CAPTURE_IMAGE_ACTIVITY_REQUEST_CODE);
	}
	
	public void onActivityResult(int requestCode, int resultCode, Intent data) {
		if(resultCode == Activity.RESULT_OK) {
			if (requestCode == SELECT_PICTURE) {
				imageSelected(data);
			} else {
				//get info from shared prefs
				SharedPreferences prefs = activity.getSharedPreferences(cameraPrefsKey, 0);
				String outputFile = prefs.getString(cameraPrefsFileName, "");
				boolean isPNG = prefs.getBoolean(cameraPrefsIsPNG, false);
				int quality = prefs.getInt(cameraPrefsQuality, 100);
	            savePicture(outputFile, quality, isPNG);
			}
		} else {
			pictureCancelled();
		}
	}
	
	void cameraActivityResult(int resultCode, Intent intent) {
		if(resultCode == Activity.RESULT_OK) {
			//get info from shared prefs
			SharedPreferences prefs = activity.getSharedPreferences(cameraPrefsKey, 0);
			String outputFile = prefs.getString(cameraPrefsFileName, "");
			boolean isPNG = prefs.getBoolean(cameraPrefsIsPNG, false);
			int quality = prefs.getInt(cameraPrefsQuality, 100);
            savePicture(outputFile, quality, isPNG);
		} else {
			pictureCancelled();
		}
	}    

	private void savePicture(final String outputFile, final int quality, final boolean isPNG) {
		//busy could be false if activity had been stopped
		busy = true;
		
		try{
			
			String dir = pictureDir();
			File dirFile = new File(dir);
			if (!dirFile.exists())
				dirFile.mkdirs();				
			String baseName = getNextPictureFile(isPNG);
			String filePath = String.format("%1$s/%2$s", dir, baseName);
			
			try {
				if (debug) System.out.println("AppMobiCamera.takePicture: file = " + filePath);
	
				OutputStream out = new BufferedOutputStream(
											new FileOutputStream(filePath), 0x8000);
				
				Bitmap bitMap = BitmapFactory.decodeFile(outputFile);
				if (bitMap==null || !bitMap.compress((isPNG?Bitmap.CompressFormat.PNG:Bitmap.CompressFormat.JPEG), 70, out)) {
					throw new IOException("Error converting to PNG");
				}
	
				bitMap.recycle();
				out.close();
				
		        fireJSEvent(
		        		"camera.internal.picture.add", 
		        		true, 
		        		null, 
		        		new String[]{String.format("ev.filename='%1$s';", baseName)}
		        );
		        fireJSEvent(
		        		"camera.picture.add", 
		        		true, 
		        		null, 
		        		new String[]{String.format("ev.filename='%1$s';", baseName)}
		        );
	
				callbackContext.success("");
			} catch (IOException e) {
				postAddError(baseName);
				if (debug) System.out.println("AppMobiCamera.takePicture err: " + e.getMessage());
			}
			finally {
				callbackContext = null;
				busy=false;
			}
		} catch(Exception e) {
			//sometimes a NPE occurs after resuming, catch it here but do nothing
			if (Debug.isDebuggerConnected()) Log.e("[intel.xdk]", "handled camera resume NPE:\n" + e.getMessage(), e);
		}
	}
	
	private void postAddError(String fileName) {
        fireJSEvent(
        		"camera.picture.add", 
        		false, 
        		null, 
        		new String[]{String.format("ev.filename='%1$s';", fileName)}
        );
	}

	private void cameraBusy() {
        fireJSEvent(
        		"camera.picture.busy", 
        		false, 
        		null, 
        		null
        );
	}
	private void pictureCancelled() {		
		busy = false;
        fireJSEvent(
        		"camera.picture.cancel", 
        		false, 
        		null, 
        		null
        );
	}
	@JavascriptInterface
	public void importPicture() {
		pickImage();
	}
	/*
	 * Show the photo gallery so the user can select a picture.
	 */
	private void pickImage() {
		if (busy) {
			cameraBusy();
		}
		busy = true;
		Intent intent = new Intent();
		intent.setType("image/*");
		intent.setAction(Intent.ACTION_GET_CONTENT);
		cordova.startActivityForResult(this, intent, SELECT_PICTURE);
    }
	/*
	 * 	Called when user has picked an image from the photo gallery.
	 */
	public void imageSelected(Intent intent) {
		
		String filePath = Camera.getPath(activity, intent.getData());
		
        System.out.println("AppMobiCamera.imageSelected: " + filePath);
        if (filePath != null) {
			File f = new File(filePath);
    		savePicture(f.getAbsolutePath(), 100, false);
        }
        busy = false;
    }
	
	/**
	 * Get a file path from a Uri. This will get the the path for Storage Access
	 * Framework Documents, as well as the _data field for the MediaStore and
	 * other file-based ContentProviders.
	 *
	 * @param context The context.
	 * @param uri The Uri to query.
	 * @author paulburke
	 */
	@SuppressLint("NewApi")
	public static String getPath(final Context context, final Uri uri) {

	    final boolean isKitKat = Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT;

	    // DocumentProvider
	    if (isKitKat && DocumentsContract.isDocumentUri(context, uri)) {
	        // ExternalStorageProvider
	        if (isExternalStorageDocument(uri)) {
	            final String docId = DocumentsContract.getDocumentId(uri);
	            final String[] split = docId.split(":");
	            final String type = split[0];

	            if ("primary".equalsIgnoreCase(type)) {
	                return Environment.getExternalStorageDirectory() + "/" + split[1];
	            }

	            // TODO handle non-primary volumes
	        }
	        // DownloadsProvider
	        else if (isDownloadsDocument(uri)) {

	            final String id = DocumentsContract.getDocumentId(uri);
	            final Uri contentUri = ContentUris.withAppendedId(
	                    Uri.parse("content://downloads/public_downloads"), Long.valueOf(id));

	            return getDataColumn(context, contentUri, null, null);
	        }
	        // MediaProvider
	        else if (isMediaDocument(uri)) {
	            final String docId = DocumentsContract.getDocumentId(uri);
	            final String[] split = docId.split(":");
	            final String type = split[0];

	            Uri contentUri = null;
	            if ("image".equals(type)) {
	                contentUri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
	            } else if ("video".equals(type)) {
	                contentUri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
	            } else if ("audio".equals(type)) {
	                contentUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
	            }

	            final String selection = "_id=?";
	            final String[] selectionArgs = new String[] {
	                    split[1]
	            };

	            return getDataColumn(context, contentUri, selection, selectionArgs);
	        }
	    }
	    // MediaStore (and general)
	    else if ("content".equalsIgnoreCase(uri.getScheme())) {
	        return getDataColumn(context, uri, null, null);
	    }
	    // File
	    else if ("file".equalsIgnoreCase(uri.getScheme())) {
	        return uri.getPath();
	    }

	    return null;
	}

	/**
	 * Get the value of the data column for this Uri. This is useful for
	 * MediaStore Uris, and other file-based ContentProviders.
	 *
	 * @param context The context.
	 * @param uri The Uri to query.
	 * @param selection (Optional) Filter used in the query.
	 * @param selectionArgs (Optional) Selection arguments used in the query.
	 * @return The value of the _data column, which is typically a file path.
	 */
	public static String getDataColumn(Context context, Uri uri, String selection,
	        String[] selectionArgs) {

	    Cursor cursor = null;
	    final String column = "_data";
	    final String[] projection = {
	            column
	    };

	    try {
	        cursor = context.getContentResolver().query(uri, projection, selection, selectionArgs,
	                null);
	        if (cursor != null && cursor.moveToFirst()) {
	            final int column_index = cursor.getColumnIndexOrThrow(column);
	            return cursor.getString(column_index);
	        }
	    } finally {
	        if (cursor != null)
	            cursor.close();
	    }
	    return null;
	}


	/**
	 * @param uri The Uri to check.
	 * @return Whether the Uri authority is ExternalStorageProvider.
	 */
	public static boolean isExternalStorageDocument(Uri uri) {
	    return "com.android.externalstorage.documents".equals(uri.getAuthority());
	}

	/**
	 * @param uri The Uri to check.
	 * @return Whether the Uri authority is DownloadsProvider.
	 */
	public static boolean isDownloadsDocument(Uri uri) {
	    return "com.android.providers.downloads.documents".equals(uri.getAuthority());
	}

	/**
	 * @param uri The Uri to check.
	 * @return Whether the Uri authority is MediaProvider.
	 */
	public static boolean isMediaDocument(Uri uri) {
	    return "com.android.providers.media.documents".equals(uri.getAuthority());
	}
	
	public void importCancelled() {
		pictureCancelled();
	}
	private final String baseFromUrl(String url) {
		int ind = url.lastIndexOf('/');
		return (ind < 0 || ind == url.length() - 1) ? url : url.substring(ind + 1);
	}
	private final String fileFromUrl(String url) {
		return pictureDir() + "/" + baseFromUrl(url);
	}
	public void deletePicture(String url) {
		String filePath = fileFromUrl(url);
		String baseName = baseFromUrl(url);
		if (debug) System.out.println("AppMobiCamera.deletePicture: " + url);
		File f = new File(filePath);
		boolean removed = f.delete();
		
		if (removed) {
			//only fire internal if removed
	        fireJSEvent(
	        		"camera.internal.picture.remove", 
	        		true, 
	        		null, 
	        		new String[]{String.format("ev.filename='%1$s';", baseName)}
	        );
		}
		//always fire regular event
        fireJSEvent(
        		"camera.picture.remove", 
        		removed, 
        		null, 
        		new String[]{String.format("ev.filename='%1$s';", baseName)}
        );
	}

	public void clearPictures() {
		// Remove all the files.
		String dirName = pictureDir();
		File dir = new File(dirName);
		String[] children = dir.list();
		int cnt = children == null ? 0 : children.length;
        for (int i = 0; i < cnt; i++) {
            File file = new File(dir, children[i]);
            Boolean bool = file.delete();
        }
        fireJSEvent(
        		"camera.internal.picture.clear", 
        		true, 
        		null, 
        		null
        );
        fireJSEvent(
        		"camera.picture.clear", 
        		true, 
        		null, 
        		null
        );
	} 

	private void fireJSEvent(String type, boolean success, String[] preStatements, String[] postStatements) {
		final StringBuilder jsBuilder = new StringBuilder();

		jsBuilder.append("javascript:");
		
		if(preStatements!=null) {
			for(String statement:preStatements) {
				jsBuilder.append(statement);
			}
		}
		
		jsBuilder.append("var ev = document.createEvent('Events');");
		jsBuilder.append("ev.initEvent('intel.xdk.");
		jsBuilder.append(type);
		jsBuilder.append("',true,true);");
		jsBuilder.append("ev.success=");
		jsBuilder.append((success?"true":"false")+";");
		
		if(postStatements!=null) {
			for(String statement:postStatements) {
				jsBuilder.append(statement);
			}
		}

		jsBuilder.append("document.dispatchEvent(ev);");
		
		final String js = jsBuilder.toString();
		Log.i("IntelXDKCamera", js);
		
		activity.runOnUiThread(new Runnable() {

			public void run() {
				webView.loadUrl(js);
			}

		});
	}
}