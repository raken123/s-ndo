package com.bodyparty.app

import android.app.Activity
import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream

/** Saves Nonsense Cam recordings (sent from the page in base64 chunks) to Movies/BodyParty. */
class AppBridge(private val activity: Activity) {

    private class Save(val uri: Uri?, val out: OutputStream)

    private val saves = HashMap<Int, Save>()
    private var nextId = 1

    @JavascriptInterface
    fun saveBegin(name: String, mime: String): Int = try {
        val type = mime.substringBefore(';').ifBlank { "video/webm" }
        val save = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Video.Media.DISPLAY_NAME, name)
                put(MediaStore.Video.Media.MIME_TYPE, type)
                put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/BodyParty")
                put(MediaStore.Video.Media.IS_PENDING, 1)
            }
            val uri = activity.contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("insert failed")
            Save(uri, activity.contentResolver.openOutputStream(uri) ?: throw IllegalStateException("open failed"))
        } else {
            val dir = File(activity.getExternalFilesDir(Environment.DIRECTORY_MOVIES), "BodyParty").apply { mkdirs() }
            Save(null, FileOutputStream(File(dir, name)))
        }
        synchronized(saves) { val id = nextId++; saves[id] = save; id }
    } catch (e: Exception) {
        -1
    }

    @JavascriptInterface
    fun saveChunk(id: Int, base64: String): Boolean = try {
        val s = synchronized(saves) { saves[id] } ?: throw IllegalStateException("unknown save")
        s.out.write(Base64.decode(base64, Base64.DEFAULT))
        true
    } catch (e: Exception) {
        false
    }

    @JavascriptInterface
    fun saveEnd(id: Int): Boolean = try {
        val s = synchronized(saves) { saves.remove(id) } ?: throw IllegalStateException("unknown save")
        s.out.close()
        if (s.uri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            activity.contentResolver.update(s.uri, ContentValues().apply { put(MediaStore.Video.Media.IS_PENDING, 0) }, null, null)
        }
        true
    } catch (e: Exception) {
        false
    }
}
