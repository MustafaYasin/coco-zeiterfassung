#!/usr/bin/env bash
# Builds the production iPad/iPhone app (live Supabase) and uploads it to
# App Store Connect for TestFlight. Signing uses the Apple ID signed in to Xcode.
# Usage: scripts/ios-testflight.sh <TEAM_ID>
set -euo pipefail

TEAM_ID="${1:?Team-ID aus developer.apple.com/account (Mitgliedschaft) angeben}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/ios/build"
BUILD_NUMBER="$(date +%Y%m%d%H%M)"

cd "$ROOT"
npm run ios:sync
if grep -q "127.0.0.1:54321" ios/App/App/public/assets/*.js; then
  echo "Abbruch: Build zeigt auf die lokale Testdatenbank." >&2
  exit 1
fi

rm -rf "$OUT"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination "generic/platform=iOS" -archivePath "$OUT/App.xcarchive" \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" archive
# Archived unsigned on purpose: automatic signing would demand a registered
# device for the development profile. The export below signs for distribution.

cat > "$OUT/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
EOF

xcodebuild -exportArchive -archivePath "$OUT/App.xcarchive" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" -exportPath "$OUT/export" \
  -allowProvisioningUpdates

echo "Hochgeladen: COCO Zeit, Build $BUILD_NUMBER. In App Store Connect > TestFlight erscheint er nach der Verarbeitung."
