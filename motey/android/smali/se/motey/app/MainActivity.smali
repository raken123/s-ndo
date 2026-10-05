.class public Lse/motey/app/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"

# Motey Android shell: one full-screen WebView showing assets/www/index.html,
# with a JavaScript bridge (window.MoteyAndroid) for files, links and speech.

.field public web:Landroid/webkit/WebView;
.field public fileCallback:Landroid/webkit/ValueCallback;
.field public pendingPerm:Landroid/webkit/PermissionRequest;


.method public constructor <init>()V
    .registers 1
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method


.method protected onCreate(Landroid/os/Bundle;)V
    .registers 6

    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v0, p0, Lse/motey/app/MainActivity;->web:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v1
    const/4 v2, 0x1
    const/4 v3, 0x0
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDatabaseEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V
    # The app is served from file:// and calls Wikipedia and the Claude API.
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowUniversalAccessFromFileURLs(Z)V
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    new-instance v1, Lse/motey/app/Client;
    invoke-direct {v1, p0}, Lse/motey/app/Client;-><init>(Lse/motey/app/MainActivity;)V
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    new-instance v1, Lse/motey/app/Chrome;
    invoke-direct {v1, p0}, Lse/motey/app/Chrome;-><init>(Lse/motey/app/MainActivity;)V
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V

    new-instance v1, Lse/motey/app/Bridge;
    invoke-direct {v1, p0}, Lse/motey/app/Bridge;-><init>(Lse/motey/app/MainActivity;)V
    const-string v2, "MoteyAndroid"
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->addJavascriptInterface(Ljava/lang/Object;Ljava/lang/String;)V

    invoke-virtual {p0, v0}, Lse/motey/app/MainActivity;->setContentView(Landroid/view/View;)V

    const-string v1, "file:///android_asset/www/index.html"
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V

    # Android 13+: ask once for permission to show message notifications
    sget v1, Landroid/os/Build$VERSION;->SDK_INT:I
    const/16 v2, 0x21
    if-lt v1, v2, :no_notif
    const/4 v1, 0x1
    new-array v1, v1, [Ljava/lang/String;
    const-string v2, "android.permission.POST_NOTIFICATIONS"
    const/4 v3, 0x0
    aput-object v2, v1, v3
    const/16 v2, 0x8
    invoke-virtual {p0, v1, v2}, Lse/motey/app/MainActivity;->requestPermissions([Ljava/lang/String;I)V

    :no_notif
    return-void
.end method


.method public onBackPressed()V
    .registers 3
    iget-object v0, p0, Lse/motey/app/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :exit
    invoke-virtual {v0}, Landroid/webkit/WebView;->canGoBack()Z
    move-result v1
    if-eqz v1, :exit
    invoke-virtual {v0}, Landroid/webkit/WebView;->goBack()V
    return-void

    :exit
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V
    return-void
.end method


.method protected onActivityResult(IILandroid/content/Intent;)V
    .registers 6
    invoke-super {p0, p1, p2, p3}, Landroid/app/Activity;->onActivityResult(IILandroid/content/Intent;)V
    iget-object v0, p0, Lse/motey/app/MainActivity;->fileCallback:Landroid/webkit/ValueCallback;
    if-eqz v0, :done
    invoke-static {p2, p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->parseResult(ILandroid/content/Intent;)[Landroid/net/Uri;
    move-result-object v1
    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    const/4 v1, 0x0
    iput-object v1, p0, Lse/motey/app/MainActivity;->fileCallback:Landroid/webkit/ValueCallback;

    :done
    return-void
.end method


# Opens mailto:, https: and other links in the matching app.
.method public openExternal(Landroid/net/Uri;)V
    .registers 4
    :try_start_0
    new-instance v0, Landroid/content/Intent;
    const-string v1, "android.intent.action.VIEW"
    invoke-direct {v0, v1, p1}, Landroid/content/Intent;-><init>(Ljava/lang/String;Landroid/net/Uri;)V
    const/high16 v1, 0x10000000
    invoke-virtual {v0, v1}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;
    invoke-virtual {p0, v0}, Lse/motey/app/MainActivity;->startActivity(Landroid/content/Intent;)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0
    return-void

    :catch_0
    return-void
.end method


# Camera and microphone for calls: ask Android first, then let the page have them.
.method public askMedia(Landroid/webkit/PermissionRequest;)V
    .registers 7
    iput-object p1, p0, Lse/motey/app/MainActivity;->pendingPerm:Landroid/webkit/PermissionRequest;
    const-string v0, "android.permission.CAMERA"
    invoke-virtual {p0, v0}, Lse/motey/app/MainActivity;->checkSelfPermission(Ljava/lang/String;)I
    move-result v1
    const-string v2, "android.permission.RECORD_AUDIO"
    invoke-virtual {p0, v2}, Lse/motey/app/MainActivity;->checkSelfPermission(Ljava/lang/String;)I
    move-result v3
    or-int/2addr v1, v3
    if-nez v1, :ask
    invoke-virtual {p0}, Lse/motey/app/MainActivity;->grantPending()V
    return-void

    :ask
    const/4 v1, 0x2
    new-array v3, v1, [Ljava/lang/String;
    const/4 v1, 0x0
    aput-object v0, v3, v1
    const/4 v1, 0x1
    aput-object v2, v3, v1
    const/4 v1, 0x7
    invoke-virtual {p0, v3, v1}, Lse/motey/app/MainActivity;->requestPermissions([Ljava/lang/String;I)V
    return-void
.end method


.method public grantPending()V
    .registers 3
    iget-object v0, p0, Lse/motey/app/MainActivity;->pendingPerm:Landroid/webkit/PermissionRequest;
    if-eqz v0, :done

    :try_start_0
    invoke-virtual {v0}, Landroid/webkit/PermissionRequest;->getResources()[Ljava/lang/String;
    move-result-object v1
    invoke-virtual {v0, v1}, Landroid/webkit/PermissionRequest;->grant([Ljava/lang/String;)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0

    :clear
    const/4 v0, 0x0
    iput-object v0, p0, Lse/motey/app/MainActivity;->pendingPerm:Landroid/webkit/PermissionRequest;

    :done
    return-void

    :catch_0
    goto :clear
.end method


.method public onRequestPermissionsResult(I[Ljava/lang/String;[I)V
    .registers 4
    invoke-virtual {p0}, Lse/motey/app/MainActivity;->grantPending()V
    return-void
.end method
