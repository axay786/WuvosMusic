package com.wuvos.music;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private static MainActivity instance;

    private WebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefreshLayout;
    private String serverUrl;

    private MediaPlaybackService mediaService;
    private boolean isBound = false;

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            MediaPlaybackService.LocalBinder binder = (MediaPlaybackService.LocalBinder) service;
            mediaService = binder.getService();
            isBound = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            isBound = false;
            mediaService = null;
        }
    };

    public static MainActivity getInstance() {
        return instance;
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;
        setContentView(R.layout.activity_main);

        // Request Notification Permission on Android 13+ (API 33+) for Lock Screen Media Controls
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
            }
        }

        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progress_bar);
        swipeRefreshLayout = findViewById(R.id.swipe_refresh);

        SharedPreferences prefs = getSharedPreferences("WuvosPrefs", MODE_PRIVATE);
        serverUrl = prefs.getString("server_url", getString(R.string.default_server_url));

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(ProgressBar.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(ProgressBar.GONE);
                swipeRefreshLayout.setRefreshing(false);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Toast.makeText(MainActivity.this, "Connection Notice: " + error.getDescription(), Toast.LENGTH_SHORT).show();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress == 100) {
                    progressBar.setVisibility(ProgressBar.GONE);
                } else {
                    progressBar.setVisibility(ProgressBar.VISIBLE);
                }
            }
        });

        swipeRefreshLayout.setEnabled(false);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        Intent serviceIntent = new Intent(this, MediaPlaybackService.class);
        bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE);

        webView.loadUrl(serverUrl);
    }

    public void triggerNextSong() {
        runOnUiThread(() -> webView.evaluateJavascript("if(window.wuvosPlayNext) window.wuvosPlayNext();", null));
    }

    public void triggerPrevSong() {
        runOnUiThread(() -> webView.evaluateJavascript("if(window.wuvosPlayPrev) window.wuvosPlayPrev();", null));
    }

    public void triggerTogglePlay() {
        runOnUiThread(() -> webView.evaluateJavascript("if(window.wuvosTogglePlay) window.wuvosTogglePlay();", null));
    }

    public void triggerSeekTo(double seconds) {
        runOnUiThread(() -> webView.evaluateJavascript("if(window.wuvosSeekTo) window.wuvosSeekTo(" + seconds + ");", null));
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void startMediaService() {
            try {
                Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(intent);
                } else {
                    startService(intent);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void updateMediaState(String title, String artist, String album, double durationSec, double positionSec, boolean playing, String coverBase64) {
            startMediaService();
            if (isBound && mediaService != null) {
                runOnUiThread(() -> mediaService.updateMediaState(title, artist, album, durationSec, positionSec, playing, coverBase64));
            }
        }

        @JavascriptInterface
        public void stopMediaService() {
            try {
                Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                intent.setAction(MediaPlaybackService.ACTION_STOP);
                startService(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.resumeTimers();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.resumeTimers();
        }
    }

    @Override
    protected void onDestroy() {
        if (isFinishing()) {
            try {
                Intent intent = new Intent(this, MediaPlaybackService.class);
                intent.setAction(MediaPlaybackService.ACTION_STOP);
                startService(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        if (isBound) {
            unbindService(serviceConnection);
            isBound = false;
        }
        if (instance == this) {
            instance = null;
        }
        super.onDestroy();
    }
}
