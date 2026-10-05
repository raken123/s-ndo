.class public Lse/motey/app/Bridge;
.super Ljava/lang/Object;
.source "Bridge.java"

# window.MoteyAndroid in the web app:
#   saveFile(name, base64, mime) -> String   saves to Download/Motey
#   openUrl(url)                             mailto:, https: …
#   speak(text, rate, pitch) / stopSpeaking() Swedish text-to-speech
#   shareText(text)                          the system share sheet
#   showNotification(title, text)            a notification for new messages

.field private final a:Lse/motey/app/MainActivity;
.field private final tts:Landroid/speech/tts/TextToSpeech;


.method public constructor <init>(Lse/motey/app/MainActivity;)V
    .registers 4
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lse/motey/app/Bridge;->a:Lse/motey/app/MainActivity;
    new-instance v0, Landroid/speech/tts/TextToSpeech;
    const/4 v1, 0x0
    invoke-direct {v0, p1, v1}, Landroid/speech/tts/TextToSpeech;-><init>(Landroid/content/Context;Landroid/speech/tts/TextToSpeech$OnInitListener;)V
    iput-object v0, p0, Lse/motey/app/Bridge;->tts:Landroid/speech/tts/TextToSpeech;
    return-void
.end method


.method public openUrl(Ljava/lang/String;)V
    .registers 4
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    invoke-static {p1}, Landroid/net/Uri;->parse(Ljava/lang/String;)Landroid/net/Uri;
    move-result-object v0
    iget-object v1, p0, Lse/motey/app/Bridge;->a:Lse/motey/app/MainActivity;
    invoke-virtual {v1, v0}, Lse/motey/app/MainActivity;->openExternal(Landroid/net/Uri;)V
    return-void
.end method


.method public speak(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V
    .registers 9
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    iget-object v0, p0, Lse/motey/app/Bridge;->tts:Landroid/speech/tts/TextToSpeech;

    new-instance v1, Ljava/util/Locale;
    const-string v2, "sv"
    const-string v3, "SE"
    invoke-direct {v1, v2, v3}, Ljava/util/Locale;-><init>(Ljava/lang/String;Ljava/lang/String;)V
    invoke-virtual {v0, v1}, Landroid/speech/tts/TextToSpeech;->setLanguage(Ljava/util/Locale;)I

    invoke-static {p2}, Ljava/lang/Float;->parseFloat(Ljava/lang/String;)F
    move-result v1
    invoke-virtual {v0, v1}, Landroid/speech/tts/TextToSpeech;->setSpeechRate(F)I

    invoke-static {p3}, Ljava/lang/Float;->parseFloat(Ljava/lang/String;)F
    move-result v1
    invoke-virtual {v0, v1}, Landroid/speech/tts/TextToSpeech;->setPitch(F)I

    const/4 v1, 0x0
    const/4 v2, 0x0
    const-string v3, "motey"
    invoke-virtual {v0, p1, v1, v2, v3}, Landroid/speech/tts/TextToSpeech;->speak(Ljava/lang/CharSequence;ILandroid/os/Bundle;Ljava/lang/String;)I
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0
    return-void

    :catch_0
    return-void
.end method


.method public stopSpeaking()V
    .registers 2
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    iget-object v0, p0, Lse/motey/app/Bridge;->tts:Landroid/speech/tts/TextToSpeech;
    invoke-virtual {v0}, Landroid/speech/tts/TextToSpeech;->stop()I
    return-void
.end method


.method public saveFile(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;
    .registers 10
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    const/4 v0, 0x0
    invoke-static {p2, v0}, Landroid/util/Base64;->decode(Ljava/lang/String;I)[B
    move-result-object v0

    sget v1, Landroid/os/Build$VERSION;->SDK_INT:I
    const/16 v2, 0x1d
    if-lt v1, v2, :legacy

    # Android 10+: MediaStore Downloads, no permission needed.
    new-instance v1, Landroid/content/ContentValues;
    invoke-direct {v1}, Landroid/content/ContentValues;-><init>()V
    const-string v2, "_display_name"
    invoke-virtual {v1, v2, p1}, Landroid/content/ContentValues;->put(Ljava/lang/String;Ljava/lang/String;)V
    const-string v2, "mime_type"
    invoke-virtual {v1, v2, p3}, Landroid/content/ContentValues;->put(Ljava/lang/String;Ljava/lang/String;)V
    const-string v2, "relative_path"
    const-string v3, "Download/Motey"
    invoke-virtual {v1, v2, v3}, Landroid/content/ContentValues;->put(Ljava/lang/String;Ljava/lang/String;)V

    iget-object v2, p0, Lse/motey/app/Bridge;->a:Lse/motey/app/MainActivity;
    invoke-virtual {v2}, Lse/motey/app/MainActivity;->getContentResolver()Landroid/content/ContentResolver;
    move-result-object v2
    sget-object v3, Landroid/provider/MediaStore$Downloads;->EXTERNAL_CONTENT_URI:Landroid/net/Uri;
    invoke-virtual {v2, v3, v1}, Landroid/content/ContentResolver;->insert(Landroid/net/Uri;Landroid/content/ContentValues;)Landroid/net/Uri;
    move-result-object v3
    invoke-virtual {v2, v3}, Landroid/content/ContentResolver;->openOutputStream(Landroid/net/Uri;)Ljava/io/OutputStream;
    move-result-object v4
    invoke-virtual {v4, v0}, Ljava/io/OutputStream;->write([B)V
    invoke-virtual {v4}, Ljava/io/OutputStream;->close()V

    new-instance v1, Ljava/lang/StringBuilder;
    const-string v2, "Sparad i Hämtade filer/Motey: "
    invoke-direct {v1, v2}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V
    invoke-virtual {v1, p1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
    move-result-object v1
    return-object v1

    # Android 7–9: the app's own Downloads folder.
    :legacy
    iget-object v1, p0, Lse/motey/app/Bridge;->a:Lse/motey/app/MainActivity;
    sget-object v2, Landroid/os/Environment;->DIRECTORY_DOWNLOADS:Ljava/lang/String;
    invoke-virtual {v1, v2}, Lse/motey/app/MainActivity;->getExternalFilesDir(Ljava/lang/String;)Ljava/io/File;
    move-result-object v1
    new-instance v2, Ljava/io/File;
    invoke-direct {v2, v1, p1}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V
    new-instance v3, Ljava/io/FileOutputStream;
    invoke-direct {v3, v2}, Ljava/io/FileOutputStream;-><init>(Ljava/io/File;)V
    invoke-virtual {v3, v0}, Ljava/io/FileOutputStream;->write([B)V
    invoke-virtual {v3}, Ljava/io/FileOutputStream;->close()V

    new-instance v1, Ljava/lang/StringBuilder;
    const-string v3, "Sparad: "
    invoke-direct {v1, v3}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V
    invoke-virtual {v2}, Ljava/io/File;->getAbsolutePath()Ljava/lang/String;
    move-result-object v3
    invoke-virtual {v1, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
    move-result-object v1
    return-object v1
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0

    :catch_0
    move-exception v0
    new-instance v1, Ljava/lang/StringBuilder;
    const-string v2, "Kunde inte spara: "
    invoke-direct {v1, v2}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V
    invoke-virtual {v0}, Ljava/lang/Exception;->toString()Ljava/lang/String;
    move-result-object v2
    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
    move-result-object v1
    return-object v1
.end method


.method public shareText(Ljava/lang/String;)V
    .registers 6
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    new-instance v0, Landroid/content/Intent;
    const-string v1, "android.intent.action.SEND"
    invoke-direct {v0, v1}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
    const-string v1, "text/plain"
    invoke-virtual {v0, v1}, Landroid/content/Intent;->setType(Ljava/lang/String;)Landroid/content/Intent;
    const-string v1, "android.intent.extra.TEXT"
    invoke-virtual {v0, v1, p1}, Landroid/content/Intent;->putExtra(Ljava/lang/String;Ljava/lang/String;)Landroid/content/Intent;
    const-string v1, "Dela med"
    invoke-static {v0, v1}, Landroid/content/Intent;->createChooser(Landroid/content/Intent;Ljava/lang/CharSequence;)Landroid/content/Intent;
    move-result-object v0
    const/high16 v1, 0x10000000
    invoke-virtual {v0, v1}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;
    iget-object v1, p0, Lse/motey/app/Bridge;->a:Lse/motey/app/MainActivity;
    invoke-virtual {v1, v0}, Lse/motey/app/MainActivity;->startActivity(Landroid/content/Intent;)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0
    return-void

    :catch_0
    return-void
.end method


.method public showNotification(Ljava/lang/String;Ljava/lang/String;)V
    .registers 9
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start_0
    iget-object v0, p0, Lse/motey/app/Bridge;->a:Lse/motey/app/MainActivity;
    const-string v1, "notification"
    invoke-virtual {v0, v1}, Lse/motey/app/MainActivity;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;
    move-result-object v1
    check-cast v1, Landroid/app/NotificationManager;

    sget v2, Landroid/os/Build$VERSION;->SDK_INT:I
    const/16 v3, 0x1a
    if-lt v2, v3, :old

    new-instance v2, Landroid/app/NotificationChannel;
    const-string v3, "motey"
    const-string v4, "Meddelanden och möten"
    const/4 v5, 0x3
    invoke-direct {v2, v3, v4, v5}, Landroid/app/NotificationChannel;-><init>(Ljava/lang/String;Ljava/lang/CharSequence;I)V
    invoke-virtual {v1, v2}, Landroid/app/NotificationManager;->createNotificationChannel(Landroid/app/NotificationChannel;)V
    new-instance v2, Landroid/app/Notification$Builder;
    invoke-direct {v2, v0, v3}, Landroid/app/Notification$Builder;-><init>(Landroid/content/Context;Ljava/lang/String;)V
    goto :build

    :old
    new-instance v2, Landroid/app/Notification$Builder;
    invoke-direct {v2, v0}, Landroid/app/Notification$Builder;-><init>(Landroid/content/Context;)V

    :build
    invoke-virtual {v0}, Lse/motey/app/MainActivity;->getApplicationInfo()Landroid/content/pm/ApplicationInfo;
    move-result-object v3
    iget v3, v3, Landroid/content/pm/ApplicationInfo;->icon:I
    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setSmallIcon(I)Landroid/app/Notification$Builder;
    invoke-virtual {v2, p1}, Landroid/app/Notification$Builder;->setContentTitle(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;
    invoke-virtual {v2, p2}, Landroid/app/Notification$Builder;->setContentText(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;
    const/4 v3, 0x1
    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setAutoCancel(Z)Landroid/app/Notification$Builder;

    # tapping the notification brings Motey back
    new-instance v3, Landroid/content/Intent;
    const-class v4, Lse/motey/app/MainActivity;
    invoke-direct {v3, v0, v4}, Landroid/content/Intent;-><init>(Landroid/content/Context;Ljava/lang/Class;)V
    const/high16 v4, 0x34000000
    invoke-virtual {v3, v4}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;
    const/4 v4, 0x0
    const/high16 v5, 0x4000000
    invoke-static {v0, v4, v3, v5}, Landroid/app/PendingIntent;->getActivity(Landroid/content/Context;ILandroid/content/Intent;I)Landroid/app/PendingIntent;
    move-result-object v3
    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setContentIntent(Landroid/app/PendingIntent;)Landroid/app/Notification$Builder;

    invoke-virtual {v2}, Landroid/app/Notification$Builder;->build()Landroid/app/Notification;
    move-result-object v2
    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J
    move-result-wide v3
    long-to-int v3, v3
    invoke-virtual {v1, v3, v2}, Landroid/app/NotificationManager;->notify(ILandroid/app/Notification;)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0
    return-void

    :catch_0
    return-void
.end method
