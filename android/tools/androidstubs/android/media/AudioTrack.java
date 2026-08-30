package android.media;

public class AudioTrack {
    public static final int MODE_STATIC = 0;
    public static final int MODE_STREAM = 1;
    public AudioTrack(int streamType, int sampleRate, int channelConfig, int audioFormat,
                      int bufferSizeInBytes, int mode) { }
    public int write(short[] audioData, int offsetInShorts, int sizeInShorts) { return 0; }
    public void play() { }
    public void stop() { }
    public void release() { }
    public void reloadStaticData() { }
}
