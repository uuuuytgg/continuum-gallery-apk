# Continuum Gallery APK

This is a local packaging copy. It does not modify or push the GitHub repository.

The bundled web app removes Google Photos/OAuth and imports photos from local device storage through the Android file picker. Imported images are stored in IndexedDB and restored on next launch.

## Performance Notes

- Android WebView chooses an effect tier automatically:
  - `low`: Snapdragon 778G / Adreno 642-class anchor; fast fixed-size motion layout.
  - `balanced`: mid/high GPUs; full motion layout with lighter particles, shadows, and throttling.
  - `full`: Snapdragon 8+ Gen 1 / Adreno 730 and above; full visual treatment.
- Unknown Android GPUs start conservatively and may be upgraded by a short runtime canvas probe.
- A manual override is available for debugging through localStorage key `continuum-gallery.effectTier` with value `low`, `balanced`, or `full`.
- Imported photos are recompressed before storage: a display image up to 1600px and a preview image up to 420px are saved instead of the original camera file.
- If an older build already imported large original photos, open the import panel, tap the clear button, then import again to rebuild the smaller local photo library.

## Build

```powershell
npm install
npm run check:web
npx cap add android
npm run sync
cd android
.\gradlew.bat assembleDebug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.
