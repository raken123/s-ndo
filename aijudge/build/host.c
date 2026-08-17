/* host.c — the desktop launcher for AI Judge.
 *
 * The game is a web application, so the desktop builds do not ship a browser
 * engine: they ship this. It serves the embedded game from 127.0.0.1 and opens
 * the machine's own Chromium-family browser on it in app-window mode.
 *
 * Serving over loopback rather than opening a file:// URL is the whole point.
 * http://127.0.0.1 is a secure context, so localStorage, crypto.subtle and —
 * the one that matters here — WebXR all work. From file:// they do not, and
 * there would be no VR on the desktop at all.
 *
 * The page is embedded gzip-compressed and handed to the browser with
 * Content-Encoding: gzip, so the binary stays small and no decompressor is
 * needed on this side.
 *
 * Build:
 *   cc      -O2 -o aijudge      host.c        (Linux)
 *   x86_64-w64-mingw32-gcc -O2 -o AIJudge.exe host.c -lws2_32 -lshell32
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "aijudge_game.h"   /* AIJUDGE_HTML_GZ, AIJUDGE_HTML_GZ_LEN, AIJUDGE_VERSION */

#ifdef _WIN32
#  include <winsock2.h>
#  include <ws2tcpip.h>
#  include <windows.h>
#  include <shellapi.h>
#  define CLOSESOCK closesocket
   typedef int socklen_t;
#else
#  include <unistd.h>
#  include <sys/stat.h>
#  include <sys/socket.h>
#  include <sys/types.h>
#  include <sys/wait.h>
#  include <netinet/in.h>
#  include <arpa/inet.h>
#  include <signal.h>
#  include <errno.h>
#  define CLOSESOCK close
   typedef int SOCKET;
#  define INVALID_SOCKET (-1)
#endif

/* ------------------------------------------------------------------ */

static const char *BROWSERS[] = {
#ifdef _WIN32
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
#else
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
    "microsoft-edge", "microsoft-edge-stable", "brave-browser", "vivaldi",
#endif
    NULL
};

static void die(const char *what)
{
    fprintf(stderr, "AI Judge: %s\n", what);
#ifdef _WIN32
    MessageBoxA(NULL, what, "AI Judge", MB_OK | MB_ICONERROR);
#endif
    exit(1);
}

/* ---------------- the loopback server ---------------- */

static SOCKET open_loopback(int *port)
{
    SOCKET s = socket(AF_INET, SOCK_STREAM, 0);
    if (s == INVALID_SOCKET) die("could not open a socket");

    int one = 1;
    setsockopt(s, SOL_SOCKET, SO_REUSEADDR, (const char *)&one, sizeof one);

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof addr);
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);   /* never reachable off-box */
    addr.sin_port = 0;                                /* any free port */

    if (bind(s, (struct sockaddr *)&addr, sizeof addr) != 0) die("could not bind 127.0.0.1");
    if (listen(s, 8) != 0) die("could not listen");

    struct sockaddr_in got;
    socklen_t len = sizeof got;
    if (getsockname(s, (struct sockaddr *)&got, &len) != 0) die("could not read the port");
    *port = ntohs(got.sin_port);
    return s;
}

/* Reads the request line, discards the headers, answers with the game. */
static void serve_one(SOCKET c)
{
    char req[2048];
    int total = 0;
    for (;;) {
        int n = recv(c, req + total, (int)(sizeof req - 1 - total), 0);
        if (n <= 0) break;
        total += n;
        req[total] = '\0';
        if (strstr(req, "\r\n\r\n") || total >= (int)sizeof req - 1) break;
    }
    if (total <= 0) return;

    int head_only = (strncmp(req, "HEAD ", 5) == 0);
    int is_get    = (strncmp(req, "GET ", 4) == 0);

    if (!is_get && !head_only) {
        static const char no[] = "HTTP/1.1 405 Method Not Allowed\r\n"
                                 "Content-Length: 0\r\nConnection: close\r\n\r\n";
        send(c, no, (int)strlen(no), 0);
        return;
    }

    char header[512];
    int hn = snprintf(header, sizeof header,
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html; charset=utf-8\r\n"
        "Content-Encoding: gzip\r\n"
        "Content-Length: %u\r\n"
        "Cache-Control: no-store\r\n"
        "Connection: close\r\n\r\n",
        (unsigned)AIJUDGE_HTML_GZ_LEN);

    send(c, header, hn, 0);
    if (head_only) return;

    const char *p = (const char *)AIJUDGE_HTML_GZ;
    unsigned left = AIJUDGE_HTML_GZ_LEN;
    while (left > 0) {
        int n = send(c, p, (int)(left > 32768 ? 32768 : left), 0);
        if (n <= 0) break;
        p += n;
        left -= (unsigned)n;
    }
}

/* ---------------- launching the browser ---------------- */

#ifdef _WIN32

static HANDLE child = NULL;

static int file_exists(const char *p)
{
    DWORD a = GetFileAttributesA(p);
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

static int launch(const char *url, const char *profile)
{
    for (int i = 0; BROWSERS[i]; i++) {
        if (!file_exists(BROWSERS[i])) continue;

        char cmd[2048];
        snprintf(cmd, sizeof cmd,
            "\"%s\" --app=\"%s\" --user-data-dir=\"%s\" --no-first-run "
            "--no-default-browser-check --window-size=1280,820",
            BROWSERS[i], url, profile);

        STARTUPINFOA si;
        PROCESS_INFORMATION pi;
        memset(&si, 0, sizeof si);
        si.cb = sizeof si;
        memset(&pi, 0, sizeof pi);

        if (CreateProcessA(NULL, cmd, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
            CloseHandle(pi.hThread);
            child = pi.hProcess;
            return 1;
        }
    }
    /* No Chromium-family browser: hand the URL to whatever is registered. */
    ShellExecuteA(NULL, "open", url, NULL, NULL, SW_SHOWNORMAL);
    return 0;
}

static int child_alive(void)
{
    if (!child) return 0;
    return WaitForSingleObject(child, 0) == WAIT_TIMEOUT;
}

static void profile_dir(char *out, size_t n)
{
    char tmp[MAX_PATH];
    DWORD got = GetTempPathA(MAX_PATH, tmp);
    if (got == 0 || got > MAX_PATH) strcpy(tmp, ".\\");
    snprintf(out, n, "%saijudge-profile", tmp);
    CreateDirectoryA(out, NULL);
}

#else  /* POSIX */

static pid_t child = 0;

static int on_path(const char *name)
{
    const char *path = getenv("PATH");
    if (!path) return 0;
    char buf[4096];
    snprintf(buf, sizeof buf, "%s", path);
    for (char *dir = strtok(buf, ":"); dir; dir = strtok(NULL, ":")) {
        char full[4096];
        snprintf(full, sizeof full, "%s/%s", dir, name);
        if (access(full, X_OK) == 0) return 1;
    }
    return 0;
}

static int launch(const char *url, const char *profile)
{
    char app[1200], data[1200];
    snprintf(app, sizeof app, "--app=%s", url);
    snprintf(data, sizeof data, "--user-data-dir=%s", profile);

    for (int i = 0; BROWSERS[i]; i++) {
        if (!on_path(BROWSERS[i])) continue;
        pid_t p = fork();
        if (p == 0) {
            char *argv[] = { (char *)BROWSERS[i], app, data,
                             (char *)"--no-first-run",
                             (char *)"--no-default-browser-check",
                             (char *)"--window-size=1280,820", NULL };
            execvp(BROWSERS[i], argv);
            _exit(127);
        }
        if (p > 0) { child = p; return 1; }
    }

    if (on_path("xdg-open")) {
        pid_t p = fork();
        if (p == 0) {
            char *argv[] = { (char *)"xdg-open", (char *)url, NULL };
            execvp("xdg-open", argv);
            _exit(127);
        }
    }
    return 0;
}

static int child_alive(void)
{
    if (child <= 0) return 0;
    int status;
    pid_t r = waitpid(child, &status, WNOHANG);
    return r == 0;
}

static void profile_dir(char *out, size_t n)
{
    const char *base = getenv("XDG_CACHE_HOME");
    if (!base || !*base) base = getenv("HOME");
    if (!base || !*base) base = "/tmp";
    snprintf(out, n, "%s/.aijudge-profile", base);
    mkdir(out, 0700);
}

#endif

/* ---------------- main ---------------- */

int main(int argc, char **argv)
{
    (void)argc; (void)argv;

#ifdef _WIN32
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) die("winsock would not start");
#else
    signal(SIGPIPE, SIG_IGN);   /* a browser that hangs up must not kill us */
    signal(SIGCHLD, SIG_DFL);
#endif

    int port = 0;
    SOCKET server = open_loopback(&port);

    char url[64];
    snprintf(url, sizeof url, "http://127.0.0.1:%d/", port);

    char profile[1024];
    profile_dir(profile, sizeof profile);

    printf("AI Judge %s\n", AIJUDGE_VERSION);
    printf("  serving the hall at %s\n", url);
    fflush(stdout);

    int owned = launch(url, profile);
    if (!owned) {
        printf("  no Chromium-family browser found; opened your default browser.\n");
        printf("  close this window when you are done.\n");
        fflush(stdout);
    }

    /* One request at a time is plenty: the game is a single document, and the
       only client is the browser this process just started. */
    int served = 0;
    for (;;) {
        fd_set rd;
        FD_ZERO(&rd);
        FD_SET(server, &rd);
        struct timeval tv = { 1, 0 };

        int r = select((int)server + 1, &rd, NULL, NULL, &tv);
        if (r > 0 && FD_ISSET(server, &rd)) {
            SOCKET c = accept(server, NULL, NULL);
            if (c != INVALID_SOCKET) {
                serve_one(c);
                CLOSESOCK(c);
                served++;
            }
        }

        /* We own the browser window, so its exit is the app's exit. When the
           launch fell back to the system handler there is no process to watch,
           so the hall stays open until the user closes this window. */
        if (owned && !child_alive()) break;
    }
    (void)served;

    CLOSESOCK(server);
#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}
