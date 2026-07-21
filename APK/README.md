# Wuvos Music Player - Android APK Package

This directory contains the native Android application project for **Wuvos Music Player**.

---

## 📱 How to Get / Build Your APK

### Option 1: Automatic Build via GitHub Actions (Recommended ⭐)
We have added an automated GitHub Workflow to your repository (`.github/workflows/build-apk.yml`).

1. Push your latest code to GitHub:
   ```bash
   git add .
   git commit -m "Add APK project and build workflow"
   git push origin main
   ```
2. Go to your repository on GitHub: `https://github.com/axay786/Wuvos`
3. Click the **Actions** tab at the top.
4. Select the latest **Build Android APK** workflow run.
5. Scroll down to **Artifacts** and download **`WuvosMusic-debug.apk`** directly onto your phone!

---

### Option 2: 1-Click PWA Installation on Android (No build required!)
Since Wuvos Music includes a Web App Manifest (`static/manifest.json`), you can install it as a native app directly from Chrome:

1. Open your production URL (`https://wuvos-music.onrender.com`) on your Android phone's Google Chrome browser.
2. Tap the **Three Dots (⋮)** menu in Chrome.
3. Tap **Add to Home screen** / **Install App**.
4. Wuvos Music will install as a standalone app on your Android home screen!

---

### Option 3: Build locally using Android Studio
1. Open **Android Studio**.
2. Click **Open** and select the `e:\Py Learning\Wuvos\APK` folder.
3. Wait for Gradle sync to complete.
4. Click **Build** $\rightarrow$ **Build Bundle(s) / APK(s)** $\rightarrow$ **Build APK(s)**.
5. Android Studio will generate the `.apk` file in `APK/app/build/outputs/apk/debug/app-debug.apk`.
