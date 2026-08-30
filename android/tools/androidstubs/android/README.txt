Hand-written stubs of the framework classes this app touches.

They exist only so `tools/typecheck-ui.sh` can compile the ui package on a
machine with no Android SDK. They are never packaged, never shipped and are not
on the Gradle build's source path - the real build compiles against android.jar.
