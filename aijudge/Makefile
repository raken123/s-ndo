# AI Judge — everything is built from web/ into dist/.
#
#   make            the single file, the icons and all five packages
#   make check      play a full case in headless Chromium, then the server
#   make serve      open the hall on http://localhost:8787
#
# Tooling: python3, node (playwright for the icons and the browser tests),
# cc + mingw-w64 + dpkg-deb + genisoimage for the desktop builds, and an
# Android SDK (ANDROID_HOME) with platform 34 and build-tools 34.0.0.

VERSION := $(shell cat VERSION)
DIST    := dist

.PHONY: all web icons android desktop trailer check check-web check-server check-packages serve clean

all: web icons android desktop
	@echo
	@echo "AI Judge $(VERSION) — built:"
	@ls -1sh $(DIST)/*.html $(DIST)/*.apk $(DIST)/*.deb $(DIST)/*.exe $(DIST)/*.dmg 2>/dev/null

web:
	python3 build/mkweb.py

icons:
	node build/mkicon.js

android: web icons
	python3 build/mkandroid.py

desktop: web icons
	python3 build/mkdesktop.py

check: check-web check-server

check-web: web
	node build/verify.js
	node build/verify.js $(DIST)/aijudge.html $(DIST)/shots-single

check-server:
	node build/verify-server.js

check-packages:
	python3 build/verify-packages.py

trailer: web icons
	node build/mktrailer.js
	python3 build/mktrailer.py

serve:
	node server/server.js

clean:
	rm -rf $(DIST)/aijudge.html $(DIST)/icons $(DIST)/shots* $(DIST)/trailer \
	       $(DIST)/*.apk $(DIST)/*.deb $(DIST)/*.exe $(DIST)/*.dmg $(DIST)/*.mp4 \
	       build/.android build/.desktop
