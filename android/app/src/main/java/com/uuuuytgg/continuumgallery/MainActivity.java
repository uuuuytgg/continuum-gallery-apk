package com.uuuuytgg.continuumgallery;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private Insets lastSafeInsets = Insets.of(0, 0, 0, 0);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        configureEdgeToEdgeWindow();
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void load() {
        super.load();
        getBridge().getWebView().addJavascriptInterface(new DeviceInfoBridge(), "ContinuumDeviceInfo");
        installWebViewInsetsBridge();
        getBridge().reload();
    }

    private void configureEdgeToEdgeWindow() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = window.getAttributes();
            params.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(params);
        }
    }

    private void installWebViewInsetsBridge() {
        View webView = getBridge().getWebView();
        webView.setBackgroundColor(Color.TRANSPARENT);
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
            Insets safe = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            lastSafeInsets = safe;
            String script =
                "document.documentElement.style.setProperty('--native-safe-top','" + safe.top + "px');" +
                "document.documentElement.style.setProperty('--native-safe-right','" + safe.right + "px');" +
                "document.documentElement.style.setProperty('--native-safe-bottom','" + safe.bottom + "px');" +
                "document.documentElement.style.setProperty('--native-safe-left','" + safe.left + "px');";
            view.post(() -> getBridge().getWebView().evaluateJavascript(script, null));
            return insets;
        });
        ViewCompat.requestApplyInsets(webView);
    }

    public class DeviceInfoBridge {

        @JavascriptInterface
        public String getDeviceInfo() {
            JSONObject info = new JSONObject();
            try {
                info.put("manufacturer", safe(Build.MANUFACTURER));
                info.put("brand", safe(Build.BRAND));
                info.put("model", safe(Build.MODEL));
                info.put("device", safe(Build.DEVICE));
                info.put("board", safe(Build.BOARD));
                info.put("hardware", safe(Build.HARDWARE));
                info.put("sdkInt", Build.VERSION.SDK_INT);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    info.put("socManufacturer", safe(Build.SOC_MANUFACTURER));
                    info.put("socModel", safe(Build.SOC_MODEL));
                }
            } catch (JSONException ignored) {
                return "{}";
            }
            return info.toString();
        }

        @JavascriptInterface
        public String getSafeAreaInsets() {
            JSONObject info = new JSONObject();
            try {
                info.put("top", lastSafeInsets.top);
                info.put("right", lastSafeInsets.right);
                info.put("bottom", lastSafeInsets.bottom);
                info.put("left", lastSafeInsets.left);
            } catch (JSONException ignored) {
                return "{}";
            }
            return info.toString();
        }

        private String safe(String value) {
            return value == null ? "" : value;
        }
    }
}
