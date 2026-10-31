package de.waldlaeufer.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // eigenes Zusatzmodul anmelden (muss vor super.onCreate passieren)
        registerPlugin(WaldNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
