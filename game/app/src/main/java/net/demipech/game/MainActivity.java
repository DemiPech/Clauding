package net.demipech.game;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Coquille du jeu : une WebView plein ecran qui sert le jeu embarque (assets/www).
 *
 * Le jeu est servi sous une origine https factice : contexte securise (modules ES,
 * WebAudio, localStorage), sans passer par file://. Le cote natif ne fait que
 * trois choses : plein ecran, ecran toujours allume, et prevenir le jeu quand
 * l'app passe en arriere-plan (window.__appPause) ou que l'on appuie sur
 * retour (window.__appBack).
 */
public class MainActivity extends Activity {

    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + APP_HOST + "/index.html";

    private static final Map<String, String> MIME = new HashMap<>();

    static {
        MIME.put("html", "text/html");
        MIME.put("css", "text/css");
        MIME.put("js", "text/javascript");
        MIME.put("json", "application/json");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("webp", "image/webp");
        MIME.put("jpg", "image/jpeg");
        MIME.put("ogg", "audio/ogg");
        MIME.put("mp3", "audio/mpeg");
        MIME.put("wav", "audio/wav");
        MIME.put("woff2", "font/woff2");
    }

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF0E1320);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);

        webView.setWebViewClient(new AppClient());
        webView.loadUrl(START_URL);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller == null) return;
            controller.hide(WindowInsets.Type.systemBars());
            controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    /** Le jeu met en pause et coupe le son ; la WebView arrete ses timers. */
    @Override
    protected void onPause() {
        webView.evaluateJavascript("window.__appPause && window.__appPause()", null);
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    /** Le retour Android passe d'abord par le jeu (pause, menu) ; a l'ecran titre, il quitte. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        webView.evaluateJavascript(
                "(window.__appBack && window.__appBack()) ? 'handled' : 'exit'",
                value -> {
                    if (value == null || !value.contains("handled")) {
                        MainActivity.super.onBackPressed();
                    }
                });
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }

    // --- Fichiers du jeu ------------------------------------------------------

    private class AppClient extends WebViewClient {

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!APP_HOST.equals(url.getHost())) return null;

            String path = url.getPath();
            if (path == null || path.equals("/")) path = "/index.html";
            if (path.contains("..")) return notFound();

            String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
            String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";

            try {
                InputStream in = getAssets().open("www" + path);
                WebResourceResponse response = new WebResourceResponse(mime, "utf-8", in);
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-cache");
                response.setResponseHeaders(headers);
                return response;
            } catch (IOException e) {
                return notFound();
            }
        }

        /** Aucune navigation hors du jeu. */
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !APP_HOST.equals(request.getUrl().getHost());
        }

        private WebResourceResponse notFound() {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                    new HashMap<>(), null);
        }
    }
}
