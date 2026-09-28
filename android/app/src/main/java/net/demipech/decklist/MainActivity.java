package net.demipech.decklist;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Coquille de l'app : une WebView qui sert l'interface web embarquee (assets/www)
 * et un pont natif pour les appels reseau.
 *
 * L'interface est servie sous une origine https factice : c'est un contexte
 * securise (WebCrypto, modules ES), sans passer par file://. Les appels vers
 * CardNexus et FaBrary passent par {@link Bridge#request}, en Java : ils
 * echappent ainsi au CORS du navigateur et peuvent porter les en-tetes
 * Origin/Referer/User-Agent qu'exige le WAF de FaBrary.
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
        MIME.put("ico", "image/x-icon");
    }

    private final ExecutorService network = Executors.newFixedThreadPool(4);
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF12100F);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Un lien target=_blank reste dans cette WebView : shouldOverrideUrlLoading
        // le renvoie alors vers le navigateur.
        settings.setSupportMultipleWindows(false);
        settings.setAllowFileAccess(false);

        webView.addJavascriptInterface(new Bridge(), "AndroidApp");
        webView.setWebViewClient(new AppClient());

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(START_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    /** Le retour Android remonte d'abord dans l'interface ; a l'accueil, il quitte. */
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
        network.shutdownNow();
        webView.destroy();
        super.onDestroy();
    }

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception ignored) {
            // Aucune app pour ouvrir ce lien : rien a faire.
        }
    }

    // --- Fichiers de l'interface ---------------------------------------------

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

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (APP_HOST.equals(url.getHost())) return false;
            openExternal(url.toString());
            return true;
        }

        private WebResourceResponse notFound() {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                    new HashMap<>(), null);
        }
    }

    // --- Pont JavaScript ------------------------------------------------------

    private class Bridge {

        /**
         * Requete HTTP asynchrone. La reponse revient par
         * window.__androidHttpDone(id, status, headersJson, body, error).
         */
        @JavascriptInterface
        public void request(String id, String method, String url, String headersJson,
                            boolean hasBody, String body) {
            network.execute(() -> perform(id, method, url, headersJson, hasBody ? body : null));
        }

        @JavascriptInterface
        public boolean copyText(String text) {
            ClipboardManager clipboard = getSystemService(ClipboardManager.class);
            if (clipboard == null) return false;
            clipboard.setPrimaryClip(ClipData.newPlainText("Decklist", text));
            return true;
        }

        @JavascriptInterface
        public void openExternal(String url) {
            runOnUiThread(() -> MainActivity.this.openExternal(url));
        }
    }

    private void perform(String id, String method, String url, String headersJson, String body) {
        int status = 0;
        String responseBody = "";
        JSONObject responseHeaders = new JSONObject();
        String error = "";
        HttpURLConnection conn = null;

        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(20_000);
            conn.setReadTimeout(60_000);

            JSONObject headers = new JSONObject(TextUtils.isEmpty(headersJson) ? "{}" : headersJson);
            for (Iterator<String> it = headers.keys(); it.hasNext(); ) {
                String name = it.next();
                // Calcules par la pile HTTP elle-meme.
                if (name.equalsIgnoreCase("host") || name.equalsIgnoreCase("content-length")) continue;
                conn.setRequestProperty(name, headers.getString(name));
            }

            if (body != null) {
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                conn.setDoOutput(true);
                conn.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream out = conn.getOutputStream()) {
                    out.write(bytes);
                }
            }

            status = conn.getResponseCode();
            InputStream in = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            responseBody = in == null ? "" : readAll(in);

            for (Map.Entry<String, List<String>> entry : conn.getHeaderFields().entrySet()) {
                if (entry.getKey() == null) continue;
                responseHeaders.put(entry.getKey().toLowerCase(Locale.ROOT),
                        TextUtils.join(", ", entry.getValue()));
            }
        } catch (Exception e) {
            error = e.getClass().getSimpleName() + (e.getMessage() != null ? ": " + e.getMessage() : "");
        } finally {
            if (conn != null) conn.disconnect();
        }

        String script = "window.__androidHttpDone("
                + JSONObject.quote(id) + ","
                + status + ","
                + JSONObject.quote(responseHeaders.toString()) + ","
                + JSONObject.quote(responseBody) + ","
                + JSONObject.quote(error) + ")";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private static String readAll(InputStream in) throws IOException {
        try (InputStream stream = in) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[16 * 1024];
            for (int n; (n = stream.read(chunk)) != -1; ) buffer.write(chunk, 0, n);
            return buffer.toString(StandardCharsets.UTF_8.name());
        }
    }
}
