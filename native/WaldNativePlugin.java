package de.waldlaeufer.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Kleines Zusatzmodul für Waldläufer:
 *  - Sprachansagen als "Navigationshinweis": Musik/Hörbuch wird währenddessen leiser gestellt
 *    (Audiofokus "transient may duck") und danach wieder lauter.
 *  - Abfrage / Anfrage der Ausnahme von der Akku-Optimierung (damit Android die
 *    Navigation bei gesperrtem Bildschirm nicht beendet).
 *  - Anfrage der Benachrichtigungs-Berechtigung (Android 13+), damit die
 *    Hintergrund-Benachrichtigung sichtbar ist.
 */
@CapacitorPlugin(name = "WaldNative")
public class WaldNativePlugin extends Plugin {

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private final List<String> pending = new ArrayList<>();
    private final AtomicInteger speaking = new AtomicInteger(0);
    private final Handler main = new Handler(Looper.getMainLooper());
    private AudioManager audioManager;
    private AudioAttributes speechAttrs;
    private AudioFocusRequest focusRequest;
    private boolean hasFocus = false;
    private int utteranceCounter = 0;

    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> { };

    @Override
    public void load() {
        Context ctx = getContext();
        audioManager = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        speechAttrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
        tts = new TextToSpeech(ctx, status -> {
            if (status != TextToSpeech.SUCCESS) return;
            int res = tts.setLanguage(Locale.GERMANY);
            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts.setLanguage(Locale.GERMAN);
            }
            tts.setAudioAttributes(speechAttrs);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String utteranceId) { }
                @Override public void onDone(String utteranceId) { finished(); }
                @Override public void onError(String utteranceId) { finished(); }
            });
            main.post(() -> {
                ttsReady = true;
                for (String t : pending) speakNow(t);
                pending.clear();
            });
        });
    }

    /** Spricht einen Text und senkt dabei andere Audio-Apps ab. */
    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.isEmpty()) { call.resolve(); return; }
        main.post(() -> {
            if (ttsReady) speakNow(text); else pending.add(text);
        });
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            if (tts != null) tts.stop();
            speaking.set(0);
            abandonFocus();
        });
        call.resolve();
    }

    private void speakNow(String text) {
        requestFocus();
        speaking.incrementAndGet();
        String id = "wl-" + (++utteranceCounter);
        Bundle params = new Bundle();
        params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
        int r = tts.speak(text, TextToSpeech.QUEUE_ADD, params, id);
        if (r != TextToSpeech.SUCCESS) finished();
    }

    private void finished() {
        // kurz warten, damit das Ende der Ansage nicht abgeschnitten wird
        main.postDelayed(() -> {
            if (speaking.decrementAndGet() <= 0) {
                speaking.set(0);
                abandonFocus();
            }
        }, 350);
    }

    @SuppressWarnings("deprecation")
    private void requestFocus() {
        if (hasFocus || audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(speechAttrs)
                    .setOnAudioFocusChangeListener(focusListener)
                    .build();
            audioManager.requestAudioFocus(focusRequest);
        } else {
            audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
        }
        hasFocus = true;
    }

    @SuppressWarnings("deprecation")
    private void abandonFocus() {
        if (!hasFocus || audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
        } else {
            audioManager.abandonAudioFocus(focusListener);
        }
        hasFocus = false;
    }

    /** Ist Waldläufer von der Akku-Optimierung ausgenommen? */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        JSObject ret = new JSObject();
        boolean ignoring = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ignoring = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        ret.put("value", ignoring);
        call.resolve(ret);
    }

    /** Öffnet den System-Dialog "Akku-Optimierung für Waldläufer ausschalten". */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            } catch (Exception ignored) { }
        }
        call.resolve();
    }

    /** Fragt auf Android 13+ nach der Erlaubnis, Benachrichtigungen anzuzeigen. */
    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getActivity() != null) {
            String perm = "android.permission.POST_NOTIFICATIONS";
            if (ContextCompat.checkSelfPermission(getContext(), perm) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(getActivity(), new String[]{ perm }, 4711);
            }
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        abandonFocus();
        super.handleOnDestroy();
    }
}
