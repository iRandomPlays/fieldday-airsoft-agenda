package nl.fieldday.app;

import android.app.Activity;
import android.content.Intent;
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
 private boolean blocked = true, checking = false, destroyed = false;
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
 void check() {
  if (destroyed || checking) return;
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
     if (latest == known) edit.putString("requiredName", name);
     edit.apply();
     if (UpdatePolicy.canOpen(installed, latest, known, true)) {
      blocked = false; overlay.setVisibility(View.GONE); app.setVisibility(View.VISIBLE);
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
   + "\n\nDownload de APK, open het gedownloade bestand en bevestig de installatie in Android. Ga daarna terug naar Fieldday.", true, true);
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
  if (download) button("Update downloaden", () -> {
   long required = prefs.getLong("requiredVersion", 0);
   try { activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(BASE + "downloads/Fieldday.apk?v=" + required))); }
   catch (Exception ignored) { show("Download niet geopend", "Er kon geen browser worden geopend. Open de Fieldday-downloadlink in je browser en installeer de nieuwste APK.", true, true); }
  });
  if (retry) button("Opnieuw controleren", this::check);
 }
 private TextView text(String value, int size, int color) { TextView view = new TextView(activity); view.setText(value); view.setTextSize(size); view.setTextColor(color); return view; }
 private void button(String title, Runnable action) {
  Button button = new Button(activity); button.setText(title); button.setAllCaps(false); button.setTextColor(Color.WHITE); button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(0, 86, 82)));
  LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2); params.topMargin = dp(20); button.setMinHeight(dp(52)); content.addView(button, params); button.setOnClickListener(v -> action.run());
 }
 private int dp(int value) { return Math.round(value * activity.getResources().getDisplayMetrics().density); }
 void setDark(boolean dark) {
  String theme = dark ? "dark" : "light";
  if (!theme.equals(prefs.getString("theme", "light"))) { prefs.edit().putString("theme", theme).apply(); if (blocked) show(lastHeading, lastBody, lastDownload, lastRetry); }
 }
 void destroy() { destroyed = true; worker.shutdownNow(); }
}
