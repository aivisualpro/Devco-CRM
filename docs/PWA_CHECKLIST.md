# PWA Quality Assurance Checklist

This document provides a systematic procedure to verify that the Progressive Web App (PWA) infrastructure (manifest, service worker, caching, and offline feedback) is functioning correctly across different environments.

## 1. Verify Manifest Integrity
**Goal:** Ensure the browser successfully parses and accepts all PWA metadata.
- [ ] Open the application in **Google Chrome** (desktop).
- [ ] Open Chrome DevTools (`F12` or `Cmd+Option+I`).
- [ ] Navigate to the **Application** tab.
- [ ] Under the "Application" sidebar menu, click on **Manifest**.
- [ ] **Expected Result:** The manifest properties (Identity, Presentation, Icons) should load completely without warnings. You should see an "Installability: all green" status or the option to trigger the installation prompt.

## 2. Lighthouse PWA Audit
**Goal:** Confirm the application meets modern PWA performance and reliability standards.
- [ ] In Chrome DevTools, navigate to the **Lighthouse** tab.
- [ ] Select **Navigation** mode and check **Progressive Web App**.
- [ ] Click **Analyze page load**.
- [ ] **Expected Result:** The PWA category should score **100/100**, confirming that the service worker is registered, start URL is cached, and the manifest contains all required installable properties.

## 3. Mobile Chrome Installation & Offline Behavior
**Goal:** Ensure Android users can install the app and access the cached shell without an internet connection.
- [ ] Open the application on an Android device using **Chrome**.
- [ ] Wait for the custom "Install App" prompt to appear at the bottom of the screen, or use the browser menu to select **Install app**.
- [ ] Once installed, close the browser, turn off Wi-Fi and Mobile Data (Enable Airplane Mode).
- [ ] Launch the app from the Android Home Screen.
- [ ] **Expected Result:** The application should launch successfully, presenting the cached application shell rather than the default Chrome offline dinosaur page.

## 4. iOS Safari Standalone Verification
**Goal:** Confirm the app properly supports iOS "Add to Home Screen" and launches in a dedicated window without browser UI.
- [ ] Open the application on an iOS device using **Safari**.
- [ ] Tap the **Share** button in the bottom navigation bar.
- [ ] Scroll down and select **Add to Home Screen**.
- [ ] Close Safari and locate the new app icon on your iOS home screen.
- [ ] Tap the icon to launch the application.
- [ ] **Expected Result:** The app should open in a **standalone** view (no Safari URL bar or bottom navigation buttons), occupying the full screen like a native application.

## 5. Active Offline Banner Testing
**Goal:** Ensure the user interface accurately reflects sudden network disconnections mid-session.
- [ ] Open the application in a desktop or mobile browser.
- [ ] Navigate to the `(protected)` dashboard area.
- [ ] Using your device settings or Chrome DevTools (Network tab -> Throttle -> Offline), abruptly disable the network connection.
- [ ] **Expected Result:** The **OfflineBanner** (a slim yellow bar at the top of the screen reading "You are currently offline. Some features may be limited.") should immediately appear without requiring a page refresh.
