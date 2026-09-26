"""Runs one AI-written Python script inside a Nexora project folder.

    python python_guard.py <script.py>        (working directory = the project)

This is a guard rail, not a security sandbox: it keeps well-meaning generated code
inside the project by refusing file access outside the working directory and by
blocking process, network and native-code modules. Nexora also asks the user before
Astryx runs code for the first time.
"""
import builtins
import io
import os
import runpy
import sys

ROOT = os.path.realpath(os.getcwd())
# Top-level packages that start processes, open sockets or load native code, plus the
# network halves of urllib (urllib.parse stays: pathlib needs it).
BLOCKED_TOP = {"subprocess", "_posixsubprocess", "socket", "_socket", "ssl", "_ssl", "http", "ftplib",
               "smtplib", "ctypes", "_ctypes", "multiprocessing", "webbrowser", "requests", "urllib3"}
BLOCKED_EXACT = {"urllib.request", "asyncio.subprocess"}


def _inside(p):
    if isinstance(p, int):  # file descriptor
        return True
    p = os.fsdecode(p)
    full = os.path.realpath(p if os.path.isabs(p) else os.path.join(os.getcwd(), p))
    return full == ROOT or full.startswith(ROOT + os.sep)


def _guard(p):
    if not _inside(p):
        raise PermissionError("Nexora: bara filer i projektmappen får användas (%s)" % os.fsdecode(p))


_open = builtins.open


def _guarded_open(file, *a, **k):
    _guard(file)
    return _open(file, *a, **k)


builtins.open = _guarded_open
io.open = _guarded_open

for name in ("remove", "unlink", "rmdir", "removedirs", "mkdir", "makedirs", "listdir", "scandir", "chmod"):
    fn = getattr(os, name, None)
    if fn:
        def wrap(f):
            def g(path=".", *a, **k):
                _guard(path)
                return f(path, *a, **k)
            return g
        setattr(os, name, wrap(fn))

for name in ("rename", "replace"):
    fn = getattr(os, name)
    def wrap2(f):
        def g(src, dst, *a, **k):
            _guard(src)
            _guard(dst)
            return f(src, dst, *a, **k)
        return g
    setattr(os, name, wrap2(fn))


def _denied(*a, **k):
    raise PermissionError("Nexora: att starta processer är inte tillåtet – använd verktygen godot_run/export")


for name in ("system", "popen", "fork", "forkpty", "kill", "killpg", "execv", "execve", "execl", "execle",
             "execlp", "execlpe", "execvp", "execvpe", "spawnl", "spawnle", "spawnlp", "spawnlpe", "spawnv",
             "spawnve", "spawnvp", "spawnvpe", "posix_spawn", "posix_spawnp", "startfile"):
    if hasattr(os, name):
        setattr(os, name, _denied)


class _Blocker:
    def find_spec(self, name, path=None, target=None):
        if name.split(".")[0] in BLOCKED_TOP or name in BLOCKED_EXACT:
            raise ImportError("Nexora: modulen '%s' är inte tillåten i projektskript" % name)
        return None


sys.meta_path.insert(0, _Blocker())
for mod in list(sys.modules):
    if mod.split(".")[0] in BLOCKED_TOP or mod in BLOCKED_EXACT:
        del sys.modules[mod]

if __name__ == "__main__":
    script = sys.argv[1]
    sys.argv = [script]
    runpy.run_path(script, run_name="__main__")
