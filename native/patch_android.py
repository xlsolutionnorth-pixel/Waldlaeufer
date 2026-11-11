#!/usr/bin/env python3
"""Passt das von Capacitor erzeugte Android-Projekt für Waldläufer an.
Wird von der GitHub-Bauanleitung nach `npx cap add android` aufgerufen."""
import glob, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "android", "app", "src", "main")

# 1. Berechtigungen ins Manifest
manifest_path = os.path.join(APP, "AndroidManifest.xml")
m = open(manifest_path, encoding="utf-8").read()
perms = [
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.VIBRATE",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_LOCATION",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.WAKE_LOCK",
    "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    "android.permission.CAMERA",
]
add = []
for p in perms:
    if f'android:name="{p}"' not in m:
        add.append(f'    <uses-permission android:name="{p}" />')
if 'android.hardware.location.gps' not in m:
    add.append('    <uses-feature android:name="android.hardware.location.gps" android:required="false" />')
if 'android.hardware.camera' not in m:
    add.append('    <uses-feature android:name="android.hardware.camera" android:required="false" />')
if 'android.intent.action.TTS_SERVICE' not in m:
    add.append('    <queries><intent><action android:name="android.intent.action.TTS_SERVICE" /></intent></queries>')
m = m.replace("</manifest>", "\n".join(add) + "\n</manifest>")
open(manifest_path, "w", encoding="utf-8").write(m)
print("Manifest ergänzt:", len(add), "Einträge")

# 2. Texte für die Hintergrund-Benachrichtigung
strings_path = os.path.join(APP, "res", "values", "strings.xml")
s = open(strings_path, encoding="utf-8").read()
if "capacitor_background_geolocation_notification_channel_name" not in s:
    s = s.replace("</resources>",
        '    <string name="capacitor_background_geolocation_notification_channel_name">Navigation</string>\n'
        '    <string name="capacitor_background_geolocation_notification_color">#2f6b3f</string>\n'
        "</resources>")
    open(strings_path, "w", encoding="utf-8").write(s)
print("strings.xml ergänzt")

# 3. Eigenes Modul (WaldNative) neben die MainActivity legen und dort anmelden
found = glob.glob(os.path.join(APP, "java", "**", "MainActivity.java"), recursive=True)
if not found:
    sys.exit("MainActivity.java nicht gefunden")
target_dir = os.path.dirname(found[0])
pkg = re.search(r"^package\s+([\w.]+);", open(found[0], encoding="utf-8").read(), re.M).group(1)
for name in ("MainActivity.java", "WaldNativePlugin.java"):
    src = open(os.path.join(ROOT, "native", name), encoding="utf-8").read()
    src = re.sub(r"^package\s+[\w.]+;", f"package {pkg};", src, count=1, flags=re.M)
    open(os.path.join(target_dir, name), "w", encoding="utf-8").write(src)
print("WaldNative-Modul eingebunden in", pkg)
