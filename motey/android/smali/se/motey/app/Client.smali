.class public Lse/motey/app/Client;
.super Landroid/webkit/WebViewClient;
.source "Client.java"

# Keeps the app's own pages inside the WebView; everything else (mailto:,
# https: links) goes to the system.

.field private final a:Lse/motey/app/MainActivity;


.method public constructor <init>(Lse/motey/app/MainActivity;)V
    .registers 2
    invoke-direct {p0}, Landroid/webkit/WebViewClient;-><init>()V
    iput-object p1, p0, Lse/motey/app/Client;->a:Lse/motey/app/MainActivity;
    return-void
.end method


.method public shouldOverrideUrlLoading(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;)Z
    .registers 6
    invoke-interface {p2}, Landroid/webkit/WebResourceRequest;->getUrl()Landroid/net/Uri;
    move-result-object v0
    invoke-virtual {v0}, Landroid/net/Uri;->getScheme()Ljava/lang/String;
    move-result-object v1
    const-string v2, "file"
    invoke-virtual {v2, v1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v2
    if-eqz v2, :external
    const/4 v2, 0x0
    return v2

    :external
    iget-object v1, p0, Lse/motey/app/Client;->a:Lse/motey/app/MainActivity;
    invoke-virtual {v1, v0}, Lse/motey/app/MainActivity;->openExternal(Landroid/net/Uri;)V
    const/4 v2, 0x1
    return v2
.end method
