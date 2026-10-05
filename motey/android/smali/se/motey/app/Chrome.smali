.class public Lse/motey/app/Chrome;
.super Landroid/webkit/WebChromeClient;
.source "Chrome.java"

# Gives <input type="file"> a real file picker (attach your own files to a meeting).

.field private final a:Lse/motey/app/MainActivity;


.method public constructor <init>(Lse/motey/app/MainActivity;)V
    .registers 2
    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V
    iput-object p1, p0, Lse/motey/app/Chrome;->a:Lse/motey/app/MainActivity;
    return-void
.end method


.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .registers 8
    iget-object v0, p0, Lse/motey/app/Chrome;->a:Lse/motey/app/MainActivity;

    # cancel a picker that is still open
    iget-object v1, v0, Lse/motey/app/MainActivity;->fileCallback:Landroid/webkit/ValueCallback;
    if-eqz v1, :fresh
    const/4 v2, 0x0
    invoke-interface {v1, v2}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V

    :fresh
    iput-object p2, v0, Lse/motey/app/MainActivity;->fileCallback:Landroid/webkit/ValueCallback;

    :try_start_0
    invoke-virtual {p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->createIntent()Landroid/content/Intent;
    move-result-object v1
    const/16 v2, 0x2a
    invoke-virtual {v0, v1, v2}, Lse/motey/app/MainActivity;->startActivityForResult(Landroid/content/Intent;I)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0
    const/4 v1, 0x1
    return v1

    :catch_0
    const/4 v1, 0x0
    iput-object v1, v0, Lse/motey/app/MainActivity;->fileCallback:Landroid/webkit/ValueCallback;
    return v1
.end method


# getUserMedia() from the page (calls)
.method public onPermissionRequest(Landroid/webkit/PermissionRequest;)V
    .registers 3
    iget-object v0, p0, Lse/motey/app/Chrome;->a:Lse/motey/app/MainActivity;
    invoke-virtual {v0, p1}, Lse/motey/app/MainActivity;->askMedia(Landroid/webkit/PermissionRequest;)V
    return-void
.end method
