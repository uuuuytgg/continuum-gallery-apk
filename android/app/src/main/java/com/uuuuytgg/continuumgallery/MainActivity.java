package com.uuuuytgg.continuumgallery;

import android.os.Build;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;
import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    @Override
    protected void load() {
        super.load();
        getBridge().getWebView().addJavascriptInterface(new DeviceInfoBridge(), "ContinuumDeviceInfo");
        getBridge().reload();
    }

    public static class DeviceInfoBridge {

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
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    info.put("socManufacturer", safe(Build.SOC_MANUFACTURER));
                    info.put("socModel", safe(Build.SOC_MODEL));
                }
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
