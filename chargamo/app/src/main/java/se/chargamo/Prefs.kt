package se.chargamo

import android.content.Context
import android.content.SharedPreferences

/** Persistent app state: the Gemini key and the social-media charging lockout. */
object Prefs {
    private const val FILE = "chargamo"
    private const val KEY_API = "api_key"
    private const val KEY_LOCK_UNTIL = "lock_until"
    private const val KEY_CHARGE_BLOCKED = "charge_blocked"

    const val LOCKOUT_MS = 60 * 60 * 1000L
    const val ACTION_LOCKOUT_CHANGED = "se.chargamo.LOCKOUT_CHANGED"

    private fun prefs(c: Context): SharedPreferences =
        c.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun apiKey(c: Context): String? =
        prefs(c).getString(KEY_API, null)?.takeIf { it.isNotBlank() }
            ?: BuildConfig.GEMINI_API_KEY.takeIf { it.isNotBlank() }

    fun saveApiKey(c: Context, key: String) {
        prefs(c).edit().putString(KEY_API, key).apply()
    }

    fun lockUntil(c: Context): Long = prefs(c).getLong(KEY_LOCK_UNTIL, 0L)

    fun isLockedOut(c: Context): Boolean = System.currentTimeMillis() < lockUntil(c)

    fun startLockout(c: Context) {
        prefs(c).edit()
            .putLong(KEY_LOCK_UNTIL, System.currentTimeMillis() + LOCKOUT_MS)
            .putBoolean(KEY_CHARGE_BLOCKED, true)
            .apply()
    }

    /** True while charging has been switched off by a lockout and not yet switched back on. */
    fun isChargeBlocked(c: Context): Boolean = prefs(c).getBoolean(KEY_CHARGE_BLOCKED, false)

    fun setChargeBlocked(c: Context, blocked: Boolean) {
        prefs(c).edit().putBoolean(KEY_CHARGE_BLOCKED, blocked).apply()
    }
}
