package nl.fieldday.app;

import android.app.Activity;
import android.content.Intent;
import android.content.ClipData;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.provider.Settings;
import android.widget.ProgressBar;
import java.io.File;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.Set;
import java.util.HashSet;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Native gate: neither WebView navigation, deep links nor Back can dismiss it. */
final class UpdateGate {
 private static final String BASE = "https://irandomplays.github.io/fieldday-airsoft-agenda/";
 private final Activity activity;
 private final View app;
 private final ScrollView overlay;
 private final LinearLayout content;
 private final SharedPreferences prefs;
 private final ExecutorService worker = Executors.newSingleThreadExecutor();
 private final long installed;
 private final String installedName;
 private boolean blocked = true, checking = false, destroyed = false, downloading = false, awaitingPermission = false, installerLaunched = false;
 private File readyApk;
 private ProgressBar downloadProgress;
 private TextView downloadLabel;
 private String lastHeading = "", lastBody = "";
 private boolean lastDownload, lastRetry;

 UpdateGate(Activity activity, FrameLayout root, View app) {
  this.activity = activity; this.app = app;
  prefs = activity.getSharedPreferences("fieldday-updates", Activity.MODE_PRIVATE);
  long code = 0; String name = "onbekend";
  try {
   PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
   code = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
   name = info.versionName;
  } catch (Exception ignored) {}
  installed = code; installedName = name;
  overlay = new ScrollView(activity);
  overlay.setFillViewport(true);
  content = new LinearLayout(activity); content.setOrientation(LinearLayout.VERTICAL);
  content.setGravity(Gravity.CENTER_VERTICAL); content.setPadding(dp(28), dp(32), dp(28), dp(32));
  overlay.addView(content, new ScrollView.LayoutParams(-1, -1));
  root.addView(overlay, new FrameLayout.LayoutParams(-1, -1));
  app.setVisibility(View.GONE);
  show("Updates controleren", "Even controleren of je de nieuwste versie van Fieldday gebruikt…", false, false);
 }
 boolean isBlocking() { return blocked; }
 void resume() {
  if (destroyed || checking || downloading) return;
  if (awaitingPermission && readyApk != null) {
   awaitingPermission = false;
   if (activity.getPackageManager().canRequestPackageInstalls()) installReady(); else showReady("Toestemming is nog niet gegeven. Sta installatie vanuit Fieldday toe om verder te gaan.");
   return;
  }
  if (installerLaunched && readyApk != null) { installerLaunched = false; showReady("Installatie nog niet afgerond? Tik op installeren om opnieuw te proberen."); return; }
  check();
 }
 void check() {
  if (destroyed || checking || downloading) return;
  checking = true; blocked = true; app.setVisibility(View.GONE); overlay.setVisibility(View.VISIBLE);
  show("Updates controleren", "Een actuele versie is verplicht. De controle heeft internet nodig.", false, false);
  worker.execute(() -> {
   try {
    JSONObject release = fetchRelease();
    long latest = release.getLong("versionCode");
    String name = release.getString("versionName");
    if (release.getInt("schemaVersion") != 1 || latest <= 0 || latest > Integer.MAX_VALUE || !name.matches("[0-9]+\\.[0-9]+\\.[0-9]+")) throw new Exception("Invalid release");
    if (!release.getString("apkUrl").equals(BASE + "downloads/Fieldday.apk?v=" + latest)) throw new Exception("Unexpected download");
    if (!release.getString("sha256").matches("[a-f0-9]{64}")) throw new Exception("Invalid checksum");
    activity.runOnUiThread(() -> {
     if (destroyed) return;
     checking = false;
     long known = Math.max(latest, prefs.getLong("requiredVersion", 0));
     SharedPreferences.Editor edit = prefs.edit().putLong("requiredVersion", known);
     if (latest == known) edit.putString("requiredName", name).putString("requiredHash", release.optString("sha256"));
     edit.apply();
     if (UpdatePolicy.canOpen(installed, latest, known, true)) {
      blocked = false; activity.getSharedPreferences("fieldday-navigation", Activity.MODE_PRIVATE).edit().remove("pendingInvite").apply(); readyApk = null; activity.revokeUriPermission(UpdateApkProvider.uri(activity), Intent.FLAG_GRANT_READ_URI_PERMISSION); UpdateApkProvider.file(activity).delete(); overlay.setVisibility(View.GONE); app.setVisibility(View.VISIBLE);
     } else showRequired(false);
    });
   } catch (Exception error) {
    activity.runOnUiThread(() -> {
     if (destroyed) return;
     checking = false;
     if (prefs.getLong("requiredVersion", 0) > installed) showRequired(true);
     else show("Controle niet gelukt", "We kunnen niet controleren of Fieldday actueel is. Controleer je internetverbinding en probeer opnieuw. De app blijft gesloten totdat de controle is gelukt.", false, true);
    });
   }
  });
 }
 private JSONObject fetchRelease() throws Exception {
  HttpURLConnection connection = (HttpURLConnection) new URL(BASE + "app-update.json?check=" + System.currentTimeMillis()).openConnection();
  connection.setInstanceFollowRedirects(false); connection.setUseCaches(false);
  connection.setConnectTimeout(8000); connection.setReadTimeout(8000);
  connection.setRequestProperty("Accept", "application/json");
  connection.setRequestProperty("Cache-Control", "no-cache");
  try {
   if (connection.getResponseCode() != 200) throw new Exception("Update service unavailable");
   try (InputStream input = connection.getInputStream(); ByteArrayOutputStream data = new ByteArrayOutputStream()) {
    byte[] buffer = new byte[2048]; int count;
    while ((count = input.read(buffer)) != -1) {
     if (data.size() + count > 16384) throw new Exception("Oversized release");
     data.write(buffer, 0, count);
    }
    return new JSONObject(data.toString("UTF-8"));
   }
  } finally { connection.disconnect(); }
 }
 private void showRequired(boolean failedCheck) {
  String name = prefs.getString("requiredName", "nieuwste versie");
  show("Update verplicht", "Fieldday " + name + " is beschikbaar. Je gebruikt " + installedName + ". Installeer de update om verder te gaan. Je account en gegevens blijven behouden bij een normale update."
   + (failedCheck ? "\n\nDe nieuwe controle is niet gelukt; de eerder vastgestelde update blijft verplicht." : "")
   + "\n\nTik hieronder om de update in Fieldday te downloaden. Daarna opent het Android-installatiescherm. Bevestig daar de installatie.", true, true);
 }
 private void show(String heading, String body, boolean download, boolean retry) {
  lastHeading = heading; lastBody = body; lastDownload = download; lastRetry = retry;
  boolean dark = "dark".equals(prefs.getString("theme", "light"));
  int background = dark ? Color.rgb(24, 30, 27) : Color.rgb(247, 245, 236);
  int ink = dark ? Color.rgb(239, 242, 234) : Color.rgb(24, 47, 43);
  overlay.setBackgroundColor(background); content.removeAllViews();
  TextView brand = text("FIELDDAY", 18, ink); brand.setTypeface(Typeface.DEFAULT, Typeface.BOLD); content.addView(brand);
  TextView title = text(heading, 30, ink); title.setTypeface(Typeface.DEFAULT, Typeface.BOLD); title.setPadding(0, dp(30), 0, dp(16)); content.addView(title);
  TextView description = text(body, 16, ink); description.setLineSpacing(dp(4), 1); content.addView(description);
  if (download) button("Downloaden & installeren", this::downloadUpdate);
  if (retry) button("Opnieuw controleren", this::check);
 }
 private void downloadUpdate() {
  if (destroyed || downloading || checking) return;
  final long version = prefs.getLong("requiredVersion", 0);
  final String hash = prefs.getString("requiredHash", "");
  if (version <= installed || !hash.matches("[a-f0-9]{64}")) { check(); return; }
  downloading = true; readyApk = null;
  activity.revokeUriPermission(UpdateApkProvider.uri(activity), Intent.FLAG_GRANT_READ_URI_PERMISSION);
  show("Update downloaden", "De update wordt binnen Fieldday opgehaald en gecontroleerd. Je hoeft geen browser te openen.", false, false);
  downloadProgress = new ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal); downloadProgress.setMax(100); downloadProgress.setIndeterminate(true); content.addView(downloadProgress, new LinearLayout.LayoutParams(-1, dp(24)));
  downloadLabel = text("Download starten…", 16, Color.rgb(90, 115, 105)); content.addView(downloadLabel);
  worker.execute(() -> {
   HttpURLConnection connection = null;
   try {
    File file = UpdateApkProvider.file(activity);
    if (!ApkDownload.matches(file, hash)) {
     connection = (HttpURLConnection) new URL(BASE + "downloads/Fieldday.apk?v=" + version + "&check=" + System.currentTimeMillis()).openConnection();
     connection.setConnectTimeout(10000); connection.setReadTimeout(15000); connection.setUseCaches(false); connection.setInstanceFollowRedirects(false); connection.setRequestProperty("Accept-Encoding", "identity");
     if (connection.getResponseCode() != 200) throw new IOException("Download unavailable");
     final long[] last = {0};
     try (InputStream input = connection.getInputStream()) {
      ApkDownload.copyVerified(input, file, hash, connection.getContentLengthLong(), (bytes, total) -> {
       long time = System.currentTimeMillis(); if (time - last[0] < 150 && bytes != total) return; last[0] = time;
       activity.runOnUiThread(() -> { if (destroyed || !downloading) return; downloadProgress.setIndeterminate(total <= 0); if (total > 0) downloadProgress.setProgress((int)(bytes * 100 / total)); downloadLabel.setText(total > 0 ? (bytes * 100 / total) + "% gedownload" : String.format(java.util.Locale.ROOT, "%.1f MB gedownload", bytes / 1048576.0)); });
      });
     }
    }
    validateApk(file, version);
    activity.runOnUiThread(() -> { if (destroyed) return; downloading = false; readyApk = file; installReady(); });
   } catch (Exception error) {
    UpdateApkProvider.file(activity).delete();
    activity.runOnUiThread(() -> { if (destroyed) return; downloading = false; show("Update niet gelukt", "De update kon niet veilig worden gedownload of gecontroleerd. Controleer je internetverbinding en vrije opslagruimte. Probeer opnieuw; bij een gewijzigde release haal je eerst de nieuwste versiegegevens op.", true, true); });
   } finally { if (connection != null) connection.disconnect(); }
  });
 }
 private long version(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
 private Set<String> signers(PackageInfo info) throws Exception {
  Signature[] certificates = Build.VERSION.SDK_INT >= 28 && info.signingInfo != null ? info.signingInfo.getApkContentsSigners() : info.signatures;
  Set<String> result = new HashSet<>(); if (certificates != null) for (Signature certificate : certificates) result.add(ApkDownload.hex(MessageDigest.getInstance("SHA-256").digest(certificate.toByteArray()))); return result;
 }
 private void validateApk(File file, long expectedVersion) throws Exception {
  int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
  PackageInfo candidate = activity.getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(), flags);
  PackageInfo current = activity.getPackageManager().getPackageInfo(activity.getPackageName(), flags);
  if (candidate == null || !ApkDownload.sameRelease(current.packageName, expectedVersion, signers(current), candidate.packageName, version(candidate), signers(candidate))) throw new IOException("APK identity, version or signature does not match");
 }
 private void showReady(String message) {
  boolean allowed = activity.getPackageManager().canRequestPackageInstalls();
  show(allowed ? "Update klaar voor installatie" : "Installatie toestaan", message + (allowed ? "\n\nBevestig de installatie in het Android-scherm. Als je annuleert, blijft deze update verplicht." : "\n\nGeef Android eenmalig toestemming om updates vanuit Fieldday te installeren. Keer daarna terug naar de app."), false, false);
  if (allowed) button("Update installeren", this::installReady); else button("Installatie toestaan", this::requestInstallPermission);
  button("Opnieuw controleren", this::check);
 }
 private void requestInstallPermission() {
  try { awaitingPermission = true; activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()))); }
  catch (Exception error) { awaitingPermission = false; showReady("Android kon de installatie-instelling niet openen. Controleer deze bij de appinstellingen van Fieldday."); }
 }
 private void installReady() {
  if (readyApk == null || !readyApk.isFile()) { showRequired(false); return; }
  if (!activity.getPackageManager().canRequestPackageInstalls()) {
   showReady("De update is gedownload en gecontroleerd.");
   return;
  }
  try {
   Uri uri = UpdateApkProvider.uri(activity);
   Intent installer = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive");
   installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION); installer.setClipData(ClipData.newRawUri("Fieldday update", uri));
   showReady("De update is gecontroleerd. Android vraagt je nu om de installatie te bevestigen.");
   installerLaunched = true; activity.startActivity(installer);
  } catch (Exception error) { installerLaunched = false; showReady("Het Android-installatiescherm kon niet openen. Probeer opnieuw of controleer de installatie-instellingen."); }
 }
 private TextView text(String value, int size, int color) { TextView view = new TextView(activity); view.setText(value); view.setTextSize(size); view.setTextColor(color); return view; }
 private void button(String title, Runnable action) {
  Button button = new Button(activity); button.setText(title); button.setAllCaps(false); button.setTextColor(Color.WHITE); button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(0, 86, 82)));
  LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2); params.topMargin = dp(20); button.setMinHeight(dp(52)); content.addView(button, params); button.setOnClickListener(v -> action.run());
 }
 private int dp(int value) { return Math.round(value * activity.getResources().getDisplayMetrics().density); }
 void setDark(boolean dark) {
  String theme = dark ? "dark" : "light";
  if (!theme.equals(prefs.getString("theme", "light"))) { prefs.edit().putString("theme", theme).apply(); if (blocked && !downloading) { if (readyApk != null && !checking) showReady("De update is gedownload en gecontroleerd."); else show(lastHeading, lastBody, lastDownload, lastRetry); } }
 }
 void destroy() { destroyed = true; worker.shutdownNow(); }
}
