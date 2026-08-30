package android.content;

public interface SharedPreferences {
    interface Editor {
        Editor putInt(String key, int value);
        Editor putFloat(String key, float value);
        Editor putBoolean(String key, boolean value);
        void apply();
    }
    int getInt(String key, int defValue);
    float getFloat(String key, float defValue);
    boolean getBoolean(String key, boolean defValue);
    Editor edit();
}
