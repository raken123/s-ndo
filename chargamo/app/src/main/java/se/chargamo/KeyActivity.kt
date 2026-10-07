package se.chargamo

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast

/**
 * Share a Gemini API key (text starting with "AIza") to Chargamo from any app.
 * Keeps the main screen free of buttons and text fields.
 */
class KeyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val text = intent?.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
        val key = KEY_PATTERN.find(text)?.value
        if (key != null) {
            Prefs.saveApiKey(this, key)
            Toast.makeText(this, "Chargamo: AI-nyckeln sparad", Toast.LENGTH_SHORT).show()
            startActivity(
                Intent(this, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    .putExtra(MainActivity.EXTRA_KEY_SAVED, true),
            )
        } else {
            Toast.makeText(this, "Chargamo: ingen Gemini-nyckel hittades", Toast.LENGTH_SHORT).show()
        }
        finish()
    }

    companion object {
        private val KEY_PATTERN = Regex("AIza[0-9A-Za-z_\\-]{35}")
    }
}
