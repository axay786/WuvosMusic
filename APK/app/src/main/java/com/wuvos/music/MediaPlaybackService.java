package com.wuvos.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Base64;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

public class MediaPlaybackService extends Service {

    public static final String CHANNEL_ID = "wuvos_media_playback_channel";
    public static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_PLAY = "com.wuvos.music.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.wuvos.music.ACTION_PAUSE";
    public static final String ACTION_TOGGLE = "com.wuvos.music.ACTION_TOGGLE";
    public static final String ACTION_NEXT = "com.wuvos.music.ACTION_NEXT";
    public static final String ACTION_PREVIOUS = "com.wuvos.music.ACTION_PREVIOUS";
    public static final String ACTION_STOP = "com.wuvos.music.ACTION_STOP";

    private final IBinder binder = new LocalBinder();
    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;

    private String currentTitle = "Wuvos Music";
    private String currentArtist = "Playing Music";
    private String currentAlbum = "Wuvos";
    private boolean isPlaying = false;
    private long duration = 0;
    private long position = 0;
    private Bitmap currentCover = null;

    public class LocalBinder extends Binder {
        public MediaPlaybackService getService() {
            return MediaPlaybackService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        initMediaSession();
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "WuvosMediaSession");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                handlePlayPauseAction();
            }

            @Override
            public void onPause() {
                handlePlayPauseAction();
            }

            @Override
            public void onSkipToNext() {
                handleNextAction();
            }

            @Override
            public void onSkipToPrevious() {
                handlePrevAction();
            }

            @Override
            public void onSeekTo(long pos) {
                MainActivity mainActivity = MainActivity.getInstance();
                if (mainActivity != null) {
                    mainActivity.triggerSeekTo(pos / 1000.0);
                }
            }
        });

        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            String action = intent.getAction();
            if (ACTION_NEXT.equals(action)) {
                handleNextAction();
            } else if (ACTION_PREVIOUS.equals(action)) {
                handlePrevAction();
            } else if (ACTION_TOGGLE.equals(action) || ACTION_PLAY.equals(action) || ACTION_PAUSE.equals(action)) {
                handlePlayPauseAction();
            } else if (ACTION_STOP.equals(action)) {
                stopSelfAndClearNotification();
                return START_NOT_STICKY;
            }
        }
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        stopSelfAndClearNotification();
    }

    public void stopSelfAndClearNotification() {
        try {
            stopForeground(true);
            if (notificationManager != null) {
                notificationManager.cancel(NOTIFICATION_ID);
            }
            if (mediaSession != null) {
                mediaSession.setActive(false);
                mediaSession.release();
                mediaSession = null;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        stopSelf();
    }

    private void handleNextAction() {
        MainActivity mainActivity = MainActivity.getInstance();
        if (mainActivity != null) {
            mainActivity.triggerNextSong();
        }
    }

    private void handlePrevAction() {
        MainActivity mainActivity = MainActivity.getInstance();
        if (mainActivity != null) {
            mainActivity.triggerPrevSong();
        }
    }

    private void handlePlayPauseAction() {
        MainActivity mainActivity = MainActivity.getInstance();
        if (mainActivity != null) {
            mainActivity.triggerTogglePlay();
        }
    }

    public void updateMediaState(String title, String artist, String album, double durationSec, double positionSec, boolean playing, String coverBase64) {
        this.currentTitle = (title != null && !title.isEmpty()) ? title : "Wuvos Music";
        this.currentArtist = (artist != null && !artist.isEmpty()) ? artist : "Unknown Artist";
        this.currentAlbum = (album != null && !album.isEmpty()) ? album : "Wuvos";
        this.isPlaying = playing;
        this.duration = (long) (durationSec * 1000);
        this.position = (long) (positionSec * 1000);

        if (coverBase64 != null && coverBase64.contains(",")) {
            try {
                String cleanBase64 = coverBase64.substring(coverBase64.indexOf(",") + 1);
                byte[] decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
                this.currentCover = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
            } catch (Exception e) {
                this.currentCover = null;
            }
        }

        updateMediaSessionAndNotification();
    }

    private void updateMediaSessionAndNotification() {
        if (mediaSession == null) return;

        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        long actions = PlaybackStateCompat.ACTION_PLAY
                | PlaybackStateCompat.ACTION_PAUSE
                | PlaybackStateCompat.ACTION_PLAY_PAUSE
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                | PlaybackStateCompat.ACTION_SEEK_TO;

        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(state, position, isPlaying ? 1.0f : 0.0f);
        mediaSession.setPlaybackState(stateBuilder.build());

        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration);

        if (currentCover != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentCover);
        }
        mediaSession.setMetadata(metaBuilder.build());

        Notification notification = buildNotification();

        if (isPlaying) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } else {
            // When paused, detach foreground status so notification is dismissable / swipable by user
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_DETACH);
            } else {
                stopForeground(false);
            }
            if (notificationManager != null) {
                notificationManager.notify(NOTIFICATION_ID, notification);
            }
        }
    }

    private Notification buildNotification() {
        Intent contentIntent = new Intent(this, MainActivity.class);
        PendingIntent pContentIntent = PendingIntent.getActivity(
                this, 0, contentIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        Intent prevIntent = new Intent(this, MediaPlaybackService.class).setAction(ACTION_PREVIOUS);
        PendingIntent pPrevIntent = PendingIntent.getService(
                this, 1, prevIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        Intent toggleIntent = new Intent(this, MediaPlaybackService.class).setAction(ACTION_TOGGLE);
        PendingIntent pToggleIntent = PendingIntent.getService(
                this, 2, toggleIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        Intent nextIntent = new Intent(this, MediaPlaybackService.class).setAction(ACTION_NEXT);
        PendingIntent pNextIntent = PendingIntent.getService(
                this, 3, nextIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        int playPauseIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playPauseTitle = isPlaying ? "Pause" : "Play";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setLargeIcon(currentCover)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist + " • " + currentAlbum)
                .setContentIntent(pContentIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(isPlaying)
                .setShowWhen(false)
                .setOnlyAlertOnce(true)
                .addAction(android.R.drawable.ic_media_previous, "Previous", pPrevIntent)
                .addAction(playPauseIcon, playPauseTitle, pToggleIntent)
                .addAction(android.R.drawable.ic_media_next, "Next", pNextIntent)
                .setStyle(new MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2));

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Wuvos Music Player Controls",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Lock screen and background playback controls for Wuvos Music.");
            serviceChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            serviceChannel.setSound(null, null);
            serviceChannel.enableVibration(false);
            
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }
}
